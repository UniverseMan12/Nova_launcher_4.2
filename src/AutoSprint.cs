using System;
using System.Runtime.InteropServices;
using System.Text;

// Emit transitions, never keyboard-repeat pulses. Losing focus requires W to be
// released before rearming; a physical F6 remains owned by the player.
public sealed class AutoSprintState
{
    bool armed;
    bool held;
    public int Step(bool eligible, bool forward, bool manualSprint)
    {
        if (!eligible || !forward) {
            armed = eligible;
            bool release = held && !manualSprint;
            held = false;
            return release ? -1 : 0;
        }
        if (!armed) return 0;
        if (manualSprint) { held = false; return 0; }
        if (held) return 0;
        held = true;
        return 1;
    }
}

// Window messages go only to the client process started by this launcher. No
// SendInput, global key hook, OS keyboard-state changes or game-memory writes.
// W stays exclusively a movement input. Native Fortnite handles the separate
// F6 Sprint action, including its normal airborne/crouch restrictions.
public sealed class AutoSprint : IDisposable
{
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint pid);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern int GetClassName(IntPtr window, StringBuilder name, int count);
    [DllImport("user32.dll")] static extern short GetAsyncKeyState(int key);
    [DllImport("user32.dll", SetLastError=true)] static extern bool PostMessage(IntPtr window, uint message, IntPtr key, IntPtr data);
    readonly uint processId;
    readonly AutoSprintState state = new AutoSprintState();
    IntPtr target;
    bool disposed;
    public AutoSprint(int clientProcessId) {
        if (clientProcessId <= 0) throw new ArgumentOutOfRangeException("clientProcessId");
        processId = (uint)clientProcessId;
    }
    static bool Down(int key) { return (GetAsyncKeyState(key) & 0x8000) != 0; }
    bool IsClientWindow(IntPtr window) {
        if (window == IntPtr.Zero) return false;
        uint pid; GetWindowThreadProcessId(window, out pid);
        if (pid != processId) return false;
        var name = new StringBuilder(64); GetClassName(window, name, name.Capacity);
        return name.ToString() == "UnrealWindow";
    }
    void Send(int transition) {
        if (transition == 0 || !IsClientWindow(target)) return;
        // F6 is a non-modifier: Unreal periodically reconciles Shift with the
        // physical keyboard state, so a synthetic Shift hold cannot work here.
        // Preserve the Windows scan code and previous-state/transition bits.
        long data = 1 | (0x40L << 16);
        if (transition < 0) data |= 0xc0000000L;
        if (!PostMessage(target, transition > 0 ? 0x100u : 0x101u, new IntPtr(0x75), new IntPtr(data)))
            throw new InvalidOperationException("Auto-Sprint could not reach the Fortnite window.");
    }
    public void Tick() {
        if (disposed) return;
        IntPtr foreground = GetForegroundWindow();
        bool eligible = IsClientWindow(foreground);
        bool manual = eligible && Down(0x75);
        if (eligible && foreground != target) {
            Send(state.Step(false, false, false));
            target = foreground;
        }
        bool blocked = eligible && (Down(0x12) || Down(0x11) || Down(0x5b) || Down(0x5c) || Down(0x1b) || Down(0x77));
        Send(state.Step(eligible && !blocked, eligible && Down(0x57), manual));
    }
    public void Dispose() {
        if (disposed) return;
        try { Send(state.Step(false, false, IsClientWindow(GetForegroundWindow()) && Down(0x75))); }
        finally { disposed = true; }
    }
}
