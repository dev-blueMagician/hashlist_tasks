"""Local grader tests. Simulated tools do not compile or emulate ARM firmware."""
import contextlib
import io
import json
import os
from pathlib import Path
import shutil
import struct
import subprocess
import sys
import tempfile
import types
import unittest
from unittest.mock import patch
import zipfile

AUTHOR = Path(__file__).resolve().parents[1]
PUBLIC = AUTHOR.parent / "task"
sys.path.insert(0, str(AUTHOR / "verifier"))
import grade
import report
import build_support
import drive


def fixture(transform=lambda values: values):
    output = bytearray(report.BANNER)
    for _, seq, values in report.CASES:
        used = transform(values)
        expected = report.expected(used)
        output.extend(report.FRAME.pack(0xA5, seq, len(used), expected["sum"],
                                        expected["order"], len(values) - len(used), 0))
    return bytes(output)


def near_miss_values(values):
    return values[:(len(values) + 1) // 2]


class ProtocolTests(unittest.TestCase):
    def test_gold_fixture_scores_one(self):
        checks, records = report.evaluate_uart(fixture())
        result = report.make_report({"build": True, **checks})
        self.assertEqual(result["reward"], 1.0)
        self.assertTrue(result["strict_pass"])
        self.assertIsNone(result["failure_category"])
        self.assertEqual(len(records), len(report.CASES))

    def test_near_miss_separates(self):
        checks, _ = report.evaluate_uart(fixture(near_miss_values))
        result = report.make_report({"build": True, **checks})
        self.assertAlmostEqual(result["reward"], 5 / 17)
        self.assertEqual(set(result["info"]["failed"]), {"counts", "sums", "fifo_order", "drained"})
        self.assertLess(result["reward"], 0.3)

    def test_overflow_is_modulo_32_bits(self):
        self.assertEqual(report.expected([0xFFFFFFFF, 2])["sum"], 1)
        self.assertEqual(report.expected([0xFFFFFFFF, 2])["order"], 0xFFFFFFE1)

    def test_binary_request_layout_and_literal_control_byte(self):
        payload = report.requests()
        self.assertIn(b"\x01", payload)
        offset = 0
        for _, seq, values in report.CASES:
            self.assertEqual(payload[offset:offset + 2], bytes((seq, len(values))))
            offset += 2
            actual = [struct.unpack_from("<I", payload, offset + 4 * i)[0] for i in range(len(values))]
            self.assertEqual(actual, values)
            offset += 4 * len(values)
        self.assertEqual(offset, len(payload))

    def test_frame_size_is_thirteen(self):
        self.assertEqual(report.FRAME.size, 13)

    def test_platform_driver_matches_existing_scoring(self):
        for output in (fixture(), fixture(near_miss_values), fixture()[:-1], b"bad"):
            checks, _ = report.evaluate_uart(output)
            self.assertEqual(drive.measure(output), {"build": 1, **{k: int(v) for k, v in checks.items()}})
        self.assertEqual(drive.request_bytes(), report.requests())

    def test_platform_driver_receives_elf_and_prints_numeric_metrics(self):
        calls = []
        def board_fn(elf, data, expected):
            calls.append((elf, data, expected))
            return fixture()
        stream = io.StringIO()
        with contextlib.redirect_stdout(stream):
            drive.main("test.elf", board_fn)
        self.assertEqual(calls, [("test.elf", report.requests(), len(fixture()))])
        self.assertEqual(dict(line.split("=") for line in stream.getvalue().splitlines()),
                         {name: "1" for name in report.WEIGHTS})

    def assert_invalid(self, data):
        checks, _ = report.evaluate_uart(data)
        self.assertFalse(checks["completion"])
        self.assertFalse(checks["counts"])
        self.assertFalse(checks["sums"])

    def test_missing_frame(self):
        self.assert_invalid(fixture()[:-13])

    def test_duplicate_frame(self):
        self.assert_invalid(fixture() + fixture()[-13:])

    def test_bad_magic(self):
        data = bytearray(fixture())
        data[len(report.BANNER)] = 0xAA
        self.assert_invalid(bytes(data))

    def test_wrong_sequence(self):
        data = bytearray(fixture())
        data[len(report.BANNER) + 1] = 99
        self.assert_invalid(bytes(data))

    def test_missing_banner(self):
        self.assert_invalid(fixture()[len(report.BANNER):])

    def test_extra_debug_output(self):
        self.assert_invalid(fixture() + b"debug\n")

    def test_order_failure_retains_other_credit(self):
        data = bytearray(fixture())
        data[len(report.BANNER) + 13 * 2 + 7] ^= 1
        checks, _ = report.evaluate_uart(bytes(data))
        self.assertFalse(checks["fifo_order"])
        self.assertTrue(checks["sums"])
        self.assertTrue(checks["counts"])

    def test_failure_status_loses_return_code_credit(self):
        data = bytearray(fixture())
        data[-1] = 255
        checks, _ = report.evaluate_uart(bytes(data))
        self.assertFalse(checks["return_codes"])
        self.assertTrue(checks["completion"])

    def test_criteria_match_executable_checks(self):
        criteria = json.loads((AUTHOR / "criteria.json").read_text())
        self.assertEqual({item["id"]: item["points"] for item in criteria}, report.WEIGHTS)
        checks, _ = report.evaluate_uart(fixture(near_miss_values))
        for item in criteria:
            self.assertEqual(item["checks"], ["test_outputs.py::test_" + item["id"]])
            if "naive_a" in item["caught_by"]:
                self.assertFalse(checks[item["id"]])


class FlowTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)
        self.task = self.root / "task"
        shutil.copytree(PUBLIC, self.task, ignore=shutil.ignore_patterns("__pycache__", "build"))
        self.args = types.SimpleNamespace(task_dir=self.task, data_root=AUTHOR / "supplied_environment",
                                          work_dir=self.root / "private-work", cc=None, shell="sh",
                                          build_timeout=2, run_timeout=1)
        self.compiler = patch.object(grade, "find_compiler", return_value=sys.executable)
        self.which = patch.object(grade.shutil, "which", return_value=sys.executable)
        self.compiler.start()
        self.which.start()
        self.addCleanup(self.compiler.stop)
        self.addCleanup(self.which.stop)

    def fake_runner(self, *, probe_bad=False, candidate_bad=False, candidate_timeout=False):
        def run(command, *, cwd, stdout_path, stderr_path, timeout, payload=None):
            is_probe = stdout_path.name.startswith("probe")
            if payload is None:
                if (is_probe and probe_bad) or (not is_probe and candidate_bad):
                    return {"reason": "exited", "returncode": 1, "output": b"compile failure", "sent": False}
                Path(command[-1]).write_bytes(b"\x7fELF simulated for control-flow testing")
                return {"reason": "exited", "returncode": 0, "output": b"", "sent": False}
            return {"reason": "timeout" if candidate_timeout and not is_probe else "completed",
                    "returncode": -15, "output": fixture() if is_probe else fixture(near_miss_values),
                    "sent": True}
        return run

    def test_missing_source_is_zero(self):
        (self.task / "firmware/pipeline.c").unlink()
        result = grade.grade(self.args)
        self.assertEqual(result["reward"], 0)
        self.assertEqual(result["failure_category"], "no_submission")

    def test_missing_locked_input_is_harness_error(self):
        self.args.data_root = self.root
        with self.assertRaises(grade.HarnessError):
            grade.grade(self.args)

    def test_probe_failure_is_harness_error(self):
        with patch.object(grade, "run_process", side_effect=self.fake_runner(probe_bad=True)):
            with self.assertRaises(grade.HarnessError):
                grade.grade(self.args)

    def test_candidate_compile_failure_gets_report(self):
        with patch.object(grade, "run_process", side_effect=self.fake_runner(candidate_bad=True)):
            result = grade.grade(self.args)
        self.assertEqual(result["failure_category"], "build_failed")
        self.assertEqual(result["reward"], 0)

    def test_candidate_is_scored_and_harness_is_trusted(self):
        (self.task / "firmware/unrelated.c").write_text("unrelated file")
        with patch.object(grade, "run_process", side_effect=self.fake_runner()):
            result = grade.grade(self.args)
        self.assertAlmostEqual(result["reward"], 5 / 17)
        staged = self.args.work_dir / "candidate-app"
        self.assertEqual({p.name for p in staged.iterdir()}, {"pipeline.c"})
        self.assertEqual((staged / "pipeline.c").read_bytes(), (self.task / "firmware/pipeline.c").read_bytes())

    def test_timeout_cannot_pass(self):
        with patch.object(grade, "run_process", side_effect=self.fake_runner(candidate_timeout=True)):
            result = grade.grade(self.args)
        self.assertFalse(result["info"]["checks"]["completion"])

    def test_compile_command_uses_actual_locked_files(self):
        command = build_support.compile_command("arm-gcc", self.args.data_root, self.task / "firmware", self.root / "f.elf")
        self.assertIn(str(self.args.data_root / "start.c"), command)
        self.assertIn(str(self.args.data_root / "link.ld"), command)
        self.assertIn("-mcpu=cortex-m3", command)
        self.assertIn("-nostdlib", command)
        self.assertNotIn("west", command)
        self.assertNotIn(str(self.task / "firmware/app.c"), command)

    def test_trusted_inputs_match_public_files(self):
        self.assertEqual((AUTHOR / "verifier/probe.c").read_bytes(), (AUTHOR / "references/gold.c").read_bytes())
        self.assertNotEqual((AUTHOR / "references/naive_a.c").read_bytes(), (PUBLIC / "firmware/pipeline.c").read_bytes())

    def test_answers_define_entry_point_without_task_headers(self):
        for source in (PUBLIC / "firmware/pipeline.c", AUTHOR / "references/gold.c", AUTHOR / "references/naive_a.c"):
            text = source.read_text()
            self.assertIn("void app_main(void)", text)
            self.assertNotIn('#include "pipeline.h"', text)
            self.assertNotIn('#include "queue.h"', text)


class ProcessAndPackagingTests(unittest.TestCase):
    def setUp(self):
        temp = tempfile.TemporaryDirectory()
        self.addCleanup(temp.cleanup)
        self.root = Path(temp.name)

    def run_python(self, code, *, timeout=2, payload=None):
        return grade.run_process([sys.executable, "-u", "-c", code], cwd=self.root,
                                 stdout_path=self.root / "stdout.bin", stderr_path=self.root / "stderr.log",
                                 timeout=timeout, payload=payload)

    def test_binary_handshake_and_termination(self):
        payload = report.requests()
        code = (f"import sys,time; sys.stdout.buffer.write({report.BANNER!r}); sys.stdout.buffer.flush(); "
                f"data=sys.stdin.buffer.read({len(payload)}); open('received.bin','wb').write(data); "
                f"sys.stdout.buffer.write({fixture()[len(report.BANNER):]!r}); sys.stdout.buffer.flush(); time.sleep(60)")
        result = self.run_python(code, payload=payload)
        self.assertEqual(result["reason"], "completed")
        self.assertEqual(result["output"], fixture())
        self.assertEqual((self.root / "received.bin").read_bytes(), payload)

    def test_timeout_terminates(self):
        result = self.run_python("import time; time.sleep(60)", timeout=0.15)
        self.assertEqual(result["reason"], "timeout")

    def test_output_limit_terminates(self):
        with patch.object(grade, "MAX_LOG", 1000):
            result = self.run_python("import time; print('x'*5000); time.sleep(60)")
        self.assertEqual(result["reason"], "output_limit")

    def test_stderr_does_not_pollute_uart(self):
        result = self.run_python("import sys; print('diagnostic',file=sys.stderr); sys.stdout.buffer.write(b'\\x01\\xff')")
        self.assertEqual(result["output"], b"\x01\xff")
        self.assertIn(b"diagnostic", (self.root / "stderr.log").read_bytes())

    def test_cli_harness_error_writes_no_score(self):
        target = self.root / "report.json"
        result = subprocess.run([sys.executable, str(AUTHOR / "verifier/grade.py"),
                                 "--task-dir", str(PUBLIC), "--data-root", str(self.root / "absent"),
                                 "--work-dir", str(self.root / "work"), "--report", str(target)],
                                capture_output=True, text=True, check=False)
        self.assertEqual(result.returncode, 2)
        self.assertFalse(target.exists())
        self.assertIn("HARNESS_ERROR", result.stderr)

    def test_package_has_only_task_files_in_environment_zip(self):
        output = self.root / "package"
        status = subprocess.run([sys.executable, str(AUTHOR / "tools/package.py"), "--output", str(output)],
                                capture_output=True, text=True, check=False)
        self.assertEqual(status.returncode, 0, status.stderr)
        with zipfile.ZipFile(output / "03-environment-task-files.zip") as archive:
            names = set(archive.namelist())
        self.assertEqual(names, {"task/build.sh", "task/firmware/pipeline.c"})
        for locked in ("run.sh", "start.c", "link.ld", "uart.h"):
            self.assertFalse(any(Path(name).name == locked for name in names))
        self.assertEqual((output / "04-prompt.txt").read_bytes(), (AUTHOR / "agent/PROMPT.md").read_bytes())
        self.assertEqual((output / "04-context.txt").read_bytes(), (AUTHOR / "agent/CONTEXT.md").read_bytes())
        self.assertEqual((output / "04-title.txt").read_bytes(), (AUTHOR / "agent/TITLE.txt").read_bytes())
        self.assertEqual((output / "05-steps.txt").read_bytes(), (AUTHOR / "references/steps.md").read_bytes())
        with zipfile.ZipFile(output / "private-verifier.zip") as archive:
            self.assertEqual(archive.namelist(), ["verifier/drive.py"])

    def test_shell_build_uses_one_source_without_python(self):
        git_bash = Path("C:/Program Files/Git/bin/bash.exe")
        shell = str(git_bash) if os.name == "nt" and git_bash.is_file() else shutil.which("sh")
        if not shell:
            self.skipTest("No shell available for the build helper test")
        if os.name == "nt" and not (Path(shell).parents[1] / "usr/bin/dirname.exe").is_file():
            self.skipTest("This Windows Git shell lacks the coreutils needed to execute a POSIX build script")
        task = self.root / "data with spaces" / "task"
        shutil.copytree(PUBLIC, task, ignore=shutil.ignore_patterns("__pycache__", "build"))
        fake_bin = self.root / "fake-bin"
        fake_bin.mkdir()
        compiler = fake_bin / "arm-none-eabi-gcc"
        compiler.write_text('#!/bin/sh\nprintf "%s\\n" "$@" > "$BUILD_ARGUMENTS"\n', encoding="utf-8")
        compiler.chmod(0o755)
        arguments = self.root / "arguments.txt"
        env = dict(os.environ, BUILD_ARGUMENTS=arguments.as_posix())
        env["PATH"] = str(fake_bin) + os.pathsep + env.get("PATH", "")
        if os.name == "nt":
            command = [shell, "-c", 'PATH="/usr/bin:/bin"; PATH="$(cygpath -u "$1"):$PATH"; export PATH; exec /bin/sh "$2"',
                       "build-test", fake_bin.as_posix(), (task / "build.sh").as_posix()]
        else:
            command = [shell, str(task / "build.sh")]
        run = subprocess.run(command, env=env, cwd=self.root,
                             capture_output=True, text=True, timeout=30, check=False)
        self.assertEqual(run.returncode, 0, run.stderr)
        args = arguments.read_text().splitlines()
        self.assertEqual([arg.rsplit("/", 1)[-1] for arg in args if arg.endswith(".c")],
                         ["start.c", "pipeline.c"])
        self.assertIn("-lgcc", args)
        self.assertIn("-nostdlib", args)

    def test_reference_installers_only_change_selected_copy(self):
        task = self.root / "task"
        shutil.copytree(PUBLIC, task, ignore=shutil.ignore_patterns("build", "__pycache__"))
        for variant in ("gold", "naive_a"):
            status = subprocess.run([sys.executable, str(AUTHOR / "references" / (variant + ".py")),
                                     "--task-dir", str(task)], capture_output=True, text=True, check=False)
            self.assertEqual(status.returncode, 0, status.stderr)
            self.assertEqual((task / "firmware/pipeline.c").read_bytes(),
                             (AUTHOR / "references" / (variant + ".c")).read_bytes())

if __name__ == "__main__":
    unittest.main()
