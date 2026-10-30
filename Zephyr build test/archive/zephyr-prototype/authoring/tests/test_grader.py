"""Control-flow and scoring tests; no simulated run is a Zephyr build."""
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import time
import types
import unittest
from unittest.mock import patch
import zipfile

TASK = Path(__file__).resolve().parents[1]
PUBLIC_APP = TASK.parent / "task" / "zephyr_smoke"
sys.path.insert(0, str(TASK / "verifier"))
import grade
import report


def protocol(transform=lambda values: values):
    lines = [report.BEGIN]
    for name, values in report.CASES.items():
        used = transform(values)
        fields = report.expected(used)
        fields["remaining"] = len(values) - len(used)
        lines.append(f'CASE {name} count={fields["count"]} sum={fields["sum"]} '
                     f'order={fields["order"]} remaining={fields["remaining"]} rc=0')
    return "\n".join(lines + [report.END]) + "\n"


class ScoringTests(unittest.TestCase):
    def test_complete_correct_protocol(self):
        checks, records = report.evaluate_runtime("Boot chatter\n" + protocol())
        result = report.make_report({"build": True, **checks})
        self.assertEqual(result["reward"], 1.0)
        self.assertTrue(result["strict_pass"])
        self.assertIsNone(result["failure_category"])
        self.assertEqual(set(records), set(report.CASES))

    def test_near_miss_separates_all_designated_checks(self):
        checks, _ = report.evaluate_runtime(protocol(lambda values: values[:-1]))
        result = report.make_report({"build": True, **checks})
        self.assertAlmostEqual(result["reward"], 5 / 17)
        self.assertEqual(set(result["info"]["failed"]),
                         {"counts", "sums", "fifo_order", "drained"})
        self.assertLess(result["reward"], 0.3)

    def test_sum_and_hash_use_unsigned_wraparound(self):
        # Full-wrap case has an unwrapped sum greater than 2**32.
        values = report.CASES["full_wrap"]
        self.assertGreater(sum(values), 0xFFFFFFFF)
        self.assertEqual(report.expected([0xFFFFFFFF, 2])["sum"], 1)
        self.assertEqual(report.expected([0xFFFFFFFF, 2])["order"], 0xFFFFFFE1)
        self.assertLessEqual(report.expected(values)["order"], 0xFFFFFFFF)

    def test_order_error_does_not_erase_other_credit(self):
        text = protocol()
        old = report.expected(report.CASES["partial"])["order"]
        text = text.replace(f"order={old}", f"order={old + 1}")
        checks, _ = report.evaluate_runtime(text)
        self.assertFalse(checks["fifo_order"])
        self.assertTrue(checks["counts"])
        self.assertTrue(checks["sums"])
        self.assertTrue(checks["drained"])

    def test_nonzero_receive_status_fails_return_check(self):
        checks, _ = report.evaluate_runtime(protocol().replace("rc=0", "rc=-5", 1))
        self.assertFalse(checks["return_codes"])
        self.assertTrue(checks["counts"])

    def assert_invalid(self, text):
        checks, _ = report.evaluate_runtime(text)
        self.assertFalse(checks["completion"])
        self.assertFalse(checks["counts"])
        self.assertFalse(checks["sums"])

    def test_duplicate_case_is_rejected(self):
        text = protocol()
        self.assert_invalid(text.replace(report.END, text.splitlines()[1] + "\n" + report.END))

    def test_duplicate_frames_are_rejected(self):
        self.assert_invalid(protocol() + protocol())

    def test_missing_end_is_rejected(self):
        self.assert_invalid(protocol().replace(report.END, ""))

    def test_malformed_field_is_rejected(self):
        self.assert_invalid(protocol().replace("count=0", "count=oops", 1))

    def test_unexpected_case_is_rejected(self):
        self.assert_invalid(protocol().replace("CASE single ", "CASE unknown "))

    def test_record_outside_frame_is_rejected(self):
        lines = protocol().splitlines()
        lines[0], lines[1] = lines[1], lines[0]
        self.assert_invalid("\n".join(lines))

    def test_reordered_cases_are_rejected(self):
        lines = protocol().splitlines()
        lines[2], lines[3] = lines[3], lines[2]
        self.assert_invalid("\n".join(lines))

    def test_out_of_range_integer_is_rejected(self):
        self.assert_invalid(protocol().replace("count=0", "count=4294967296", 1))

    def test_fatal_output_invalidates_completed_frame(self):
        self.assert_invalid(protocol() + "ZEPHYR FATAL ERROR\n")

    def test_crlf_is_accepted(self):
        checks, _ = report.evaluate_runtime(protocol().replace("\n", "\r\n"))
        self.assertTrue(all(checks.values()))

    def test_criteria_match_scorer_and_near_miss(self):
        criteria = json.loads((TASK / "criteria.json").read_text())
        self.assertEqual({step["id"]: step["points"] for step in criteria}, report.WEIGHTS)
        checks, _ = report.evaluate_runtime(protocol(lambda values: values[:-1]))
        checks["build"] = True
        for step in criteria:
            self.assertEqual(step["checks"], [step["id"]])
            if "naive_a" in step["caught_by"]:
                self.assertFalse(checks[step["id"]])


class GraderFlowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        app = self.root / "submission"
        shutil.copytree(PUBLIC_APP, app)
        self.args = types.SimpleNamespace(app=app, work_dir=self.root / "work", west=sys.executable,
                                          west_cwd=self.root, build_timeout=10, run_timeout=2)

    def fake_runner(self, candidate_output=None, probe_failure=False, build_failure=False,
                    run_reason="completed", run_code=-15):
        def fake(command, *, cwd, log, timeout, completion=None):
            is_probe = log.name.startswith("probe")
            if completion is None:
                if (is_probe and probe_failure) or (not is_probe and build_failure):
                    return {"reason": "exited", "returncode": 1, "output": "compiler failed"}
                build = Path(command[command.index("-d") + 1])
                (build / "zephyr").mkdir(parents=True)
                (build / "zephyr" / "zephyr.elf").write_bytes(b"fake ELF for control-flow test")
                return {"reason": "exited", "returncode": 0, "output": "simulated build"}
            output = protocol() if is_probe else (candidate_output or protocol())
            return {"reason": "completed" if is_probe else run_reason,
                    "returncode": -15 if is_probe else run_code, "output": output}
        return fake

    def test_missing_submission_does_not_require_toolchain(self):
        (self.args.app / "src" / "pipeline.c").unlink()
        self.args.west = "nonexistent-west"
        result = grade.grade(self.args)
        self.assertEqual(result["failure_category"], "no_submission")
        self.assertEqual(result["reward"], 0)

    def test_missing_toolchain_is_harness_error(self):
        self.args.west = "nonexistent-west-for-unit-test"
        with self.assertRaises(grade.HarnessError):
            grade.grade(self.args)

    def test_environment_build_failure_is_harness_error(self):
        with patch.object(grade, "run_command", side_effect=self.fake_runner(probe_failure=True)):
            with self.assertRaises(grade.HarnessError):
                grade.grade(self.args)

    def test_candidate_compile_failure_is_scored(self):
        with patch.object(grade, "run_command", side_effect=self.fake_runner(build_failure=True)):
            result = grade.grade(self.args)
        self.assertEqual(result["failure_category"], "build_failed")
        self.assertEqual(result["reward"], 0)
        self.assertIn("counts", result["info"]["skipped"])

    def test_success_and_trusted_staging(self):
        (self.args.app / "CMakeLists.txt").write_text("malicious candidate build recipe")
        (self.args.app / "src" / "main.c").write_text("untrusted main")
        with patch.object(grade, "run_command", side_effect=self.fake_runner()):
            result = grade.grade(self.args)
        self.assertEqual(result["reward"], 1)
        staged = self.args.work_dir / "candidate-app"
        self.assertNotIn("malicious", (staged / "CMakeLists.txt").read_text())
        self.assertNotIn("untrusted", (staged / "src" / "main.c").read_text())
        self.assertEqual((staged / "src" / "pipeline.c").read_bytes(),
                         (self.args.app / "src" / "pipeline.c").read_bytes())

    def test_candidate_near_miss_is_scored(self):
        with patch.object(grade, "run_command", side_effect=self.fake_runner(
                candidate_output=protocol(lambda values: values[:-1]))):
            result = grade.grade(self.args)
        self.assertAlmostEqual(result["reward"], 5 / 17)
        self.assertEqual(result["failure_category"], "wrong_answer")

    def test_timeout_does_not_pass_even_with_end_marker(self):
        with patch.object(grade, "run_command", side_effect=self.fake_runner(run_reason="timeout")):
            result = grade.grade(self.args)
        self.assertFalse(result["strict_pass"])
        self.assertFalse(result["info"]["checks"]["completion"])

    def test_nonzero_natural_exit_does_not_pass(self):
        with patch.object(grade, "run_command", side_effect=self.fake_runner(run_reason="exited", run_code=1)):
            result = grade.grade(self.args)
        self.assertFalse(result["strict_pass"])

    def test_probe_source_matches_gold_and_starter_matches_near_miss(self):
        self.assertEqual((TASK / "verifier/probe.c").read_bytes(),
                         (TASK / "references/gold.c").read_bytes())
        self.assertEqual((PUBLIC_APP / "src/pipeline.c").read_bytes(),
                         (TASK / "references/naive_a.c").read_bytes())
        for relative in ("CMakeLists.txt", "prj.conf", "src/pipeline.h"):
            self.assertEqual((TASK / "verifier/harness" / relative).read_bytes(),
                             (PUBLIC_APP / relative).read_bytes())


class ProcessAndCliTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)

    def run_python(self, code, **kwargs):
        return grade.run_command([sys.executable, "-u", "-c", code], cwd=self.root,
                                 log=self.root / "process.log", **kwargs)

    def test_timeout_terminates_process(self):
        start = time.monotonic()
        result = self.run_python("import time; print('started'); time.sleep(60)", timeout=0.2)
        self.assertEqual(result["reason"], "timeout")
        self.assertLess(time.monotonic() - start, 8)

    def test_end_marker_terminates_live_process(self):
        result = self.run_python(f"import time; print({report.END!r}); time.sleep(60)",
                                 timeout=10, completion=report.END)
        self.assertEqual(result["reason"], "completed")

    def test_output_limit_terminates_process(self):
        # Use a reduced test-only cap rather than generating megabytes.
        with patch.object(grade, "MAX_LOG", 1000):
            result = self.run_python("import time; print('x' * 5000); time.sleep(60)", timeout=5)
        self.assertEqual(result["reason"], "output_limit")

    def cli(self, *args):
        return subprocess.run([sys.executable, str(TASK / "verifier/grade.py"), *args],
                              capture_output=True, text=True, check=False)

    def test_harness_error_writes_no_report(self):
        target = self.root / "result.json"
        result = self.cli("--app", str(PUBLIC_APP), "--report", str(target),
                          "--work-dir", str(self.root / "work"), "--west", "nonexistent-west-for-unit-test")
        self.assertEqual(result.returncode, 2)
        self.assertIn("HARNESS_ERROR", result.stderr)
        self.assertFalse(target.exists())

    def test_missing_submission_writes_zero_report(self):
        target = self.root / "result.json"
        result = self.cli("--app", str(self.root / "absent"), "--report", str(target),
                          "--work-dir", str(self.root / "work"))
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(target.read_text())["failure_category"], "no_submission")

    def test_existing_report_is_never_overwritten(self):
        target = self.root / "result.json"
        target.write_text("previous report")
        result = self.cli("--report", str(target), "--work-dir", str(self.root / "work"))
        self.assertEqual(result.returncode, 2)
        self.assertEqual(target.read_text(), "previous report")

    def test_reference_installers(self):
        app = self.root / "app"
        shutil.copytree(PUBLIC_APP, app)
        for variant in ("gold", "naive_a"):
            result = subprocess.run([sys.executable, str(TASK / "references" / f"{variant}.py"),
                                     "--app", str(app)], capture_output=True, text=True, check=False)
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual((app / "src/pipeline.c").read_bytes(),
                             (TASK / "references" / f"{variant}.c").read_bytes())

    def test_package_contains_only_allowlisted_agent_files(self):
        output = self.root / "archives"
        status = subprocess.run([sys.executable, str(TASK / "tools/package.py"),
                                 "--output", str(output)], capture_output=True, text=True, check=False)
        self.assertEqual(status.returncode, 0, status.stderr)
        with zipfile.ZipFile(output / "environment-task-files.zip") as archive:
            names = set(archive.namelist())
        self.assertEqual(names, {"task/check_environment.py", "task/zephyr_smoke/CMakeLists.txt",
                                 "task/zephyr_smoke/prj.conf", "task/zephyr_smoke/src/pipeline.c",
                                 "task/zephyr_smoke/src/pipeline.h", "task/zephyr_smoke/src/main.c"})
        self.assertTrue(all(name.startswith("task/") for name in names))
        self.assertTrue((output / "prompt.txt").is_file())
        with zipfile.ZipFile(output / "verifier-private.zip") as archive:
            self.assertIn("verifier/grade.py", archive.namelist())
            self.assertFalse(any("__pycache__" in name for name in archive.namelist()))


if __name__ == "__main__":
    unittest.main()
