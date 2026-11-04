using System;
using System.Diagnostics;
using System.Reflection;
using System.Runtime.InteropServices;

// Message-only windows: this test never displays/focuses a window or presses a
// keyboard key. Verify actual Win32 packets and rejection of another PID/class.
public static class AutoSprintWindowCheck
{
    delegate IntPtr WndProc(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    static readonly WndProc callback = DefWindowProc;
    [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Unicode)]
    struct WindowClass { public uint style; public WndProc proc; public int classBytes, windowBytes; public IntPtr instance, icon, cursor, brush; public string menu, name; }
    [StructLayout(LayoutKind.Sequential)]
    struct Message { public IntPtr window; public uint message; public UIntPtr key; public IntPtr data; public uint time; public int x,y; public uint reserved; }
    [DllImport("kernel32.dll", CharSet=CharSet.Unicode)] static extern IntPtr GetModuleHandle(string name);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern ushort RegisterClass(ref WindowClass type);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr CreateWindowEx(uint extended, string type, string title, uint style, int x, int y, int width, int height, IntPtr parent, IntPtr menu, IntPtr instance, IntPtr parameter);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern IntPtr DefWindowProc(IntPtr window, uint message, IntPtr wParam, IntPtr lParam);
    [DllImport("user32.dll")] static extern bool PeekMessage(out Message message, IntPtr window, uint min, uint max, uint flags);
    [DllImport("user32.dll")] static extern bool DestroyWindow(IntPtr window);
    [DllImport("user32.dll", CharSet=CharSet.Unicode)] static extern bool UnregisterClass(string name, IntPtr instance);
    static void Check(bool value, string label) { if (!value) throw new Exception(label); }
    static void Send(AutoSprint helper, IntPtr window, int transition) {
        typeof(AutoSprint).GetField("target", BindingFlags.Instance|BindingFlags.NonPublic).SetValue(helper,window);
        typeof(AutoSprint).GetMethod("Send", BindingFlags.Instance|BindingFlags.NonPublic).Invoke(helper,new object[]{transition});
    }
    public static void Run() {
        IntPtr instance = GetModuleHandle(null);
        foreach (string name in new[]{"UnrealWindow","NovaSprintUnrelated"}) {
            var type = new WindowClass { proc=callback, instance=instance, name=name };
            Check(RegisterClass(ref type)!=0,"Register test class");
            IntPtr window = CreateWindowEx(0,name,"",0,0,0,0,0,new IntPtr(-3),IntPtr.Zero,instance,IntPtr.Zero);
            try {
                Check(window!=IntPtr.Zero,"Create message-only window");
                using(var helper = new AutoSprint(Process.GetCurrentProcess().Id)) {
                    Send(helper,window,1); Send(helper,window,-1);
                    Message message;
                    bool found = PeekMessage(out message,window,0x100,0x101,1);
                    if (name!="UnrealWindow") { Check(!found,"Ignore unrelated class"); continue; }
                    Check(found && message.message==0x100 && message.key.ToUInt64()==0x7b && message.data.ToInt64()==0x00580001,"F12 down packet");
                    Check(PeekMessage(out message,window,0x100,0x101,1) && message.message==0x101 && message.data.ToInt64()==0xc0580001L,"F12 up packet");
                    Check(!PeekMessage(out message,window,0x100,0x101,1),"Exactly one down/up pair");
                }
                using(var foreign = new AutoSprint(Process.GetCurrentProcess().Id+1)) {
                    Send(foreign,window,1); Message message;
                    Check(!PeekMessage(out message,window,0x100,0x101,1),"Ignore foreign process");
                }
            } finally { if(window!=IntPtr.Zero) DestroyWindow(window); UnregisterClass(name,instance); }
        }
    }
}
