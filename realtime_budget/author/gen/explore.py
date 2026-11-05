import math
ISR = {"FOC": (50.0, 9.0, False), "CAN": (222.0, 52.0, True), "SYSTICK": (1000.0, 3.0, True)}
TASKS = [("SpeedCtrl", 1000, 1000, 150), ("CanComm", 5000, 5000, 380), ("Monitor", 10000, 10000, 780),
         ("Supervisor", 20000, 20000, 240), ("NvM", 100000, 100000, 3900)]
ORDER = [0, 1, 2, 3, 4]
def monitored(C, isr=ISR):
    W = C
    while True:
        ch = sum(math.ceil(W / T) * c for T, c, g in isr.values() if g)
        un = sum(math.ceil(W / T) * c for T, c, g in isr.values() if not g)
        if C + ch + un == W: return C + ch, W
        W = C + ch + un
def rta(B):
    R = {}
    for pos, i in enumerate(ORDER):
        r = B[i]
        while True:
            rn = B[i] + sum(math.ceil(r / TASKS[j][1]) * B[j] for j in ORDER[:pos]) + sum(math.ceil(r / T) * c for T, c, g in ISR.values() if not g)
            if rn == r or rn > 5 * TASKS[i][2]: break
            r = rn
        R[i] = rn if rn == r else float("inf")
    return R
M = [monitored(C)[0] for _, _, _, C in TASKS]
obs = {"CAN": (1050.0, 52.0, True), "FOC": ISR["FOC"], "SYSTICK": ISR["SYSTICK"]}
Mobs = [monitored(C, obs)[0] for _, _, _, C in TASKS]
for i, (n, T, D, C) in enumerate(TASKS):
    print(f"{n:10s} C={C:5.0f} M={M[i]:7.1f} M/C={M[i]/C:5.3f}  Mobs(1.05ms)={Mobs[i]:7.1f} obs/M={Mobs[i]/M[i]:5.3f}")
def score(name, B, N):
    R = rta(B); k = 20000 + R[3]
    met = sum(1 for i in range(5) if R[i] <= TASKS[i][2])
    tmin = N / 47.0 * 1000; tmax = N / 17.0
    print(f"{name:8s} ratios=" + " ".join(f"{B[i]/M[i]:5.3f}" for i in range(5)) + f" met={met} kick={k:7.0f} N={N} margin={tmin-k:7.0f}us tmax={tmax:5.1f}ms")
score("gold", [round(m * 1.10) for m in M], 4 * (299 + 1))
score("x1.25", [m * 1.25 for m in M], 4 * (299 + 1))
score("starter", [230, 430, 940, 290, 4700], 1024)
score("naive_a", [round(1.2 * c) for *_, c in TASKS], 4 * 300)
score("naive_b", [round(m * 1.10) for m in M], 4 * 256)
score("naive_c", [round(1.15 * m) for m in Mobs], 4 * 256)
print("window N: (%.0f, %.0f]" % (0.047 * (20000 + rta([m * 1.25 for m in M])[3]), 0.075 * 17000))
