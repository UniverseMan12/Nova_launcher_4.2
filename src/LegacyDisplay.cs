using System;
using System.IO;
using System.Text;
using System.Text.RegularExpressions;
using System.Runtime.InteropServices;

// Fortnite 4.2 can crash while initializing its loading screen when a saved
// borderless resolution differs from the desktop. Preserve a byte-exact backup
// and adjust only the four startup-resolution values, never the display itself.
public static class LegacyDisplay
{
    [StructLayout(LayoutKind.Explicit, Size = 220)]
    struct DisplayMode {
        [FieldOffset(68)] public ushort size;
        [FieldOffset(172)] public uint width;
        [FieldOffset(176)] public uint height;
    }
    [DllImport("user32.dll", CharSet = CharSet.Unicode)]
    static extern bool EnumDisplaySettings(string device, int mode, ref DisplayMode settings);

    public static int[] DesktopSize() {
        var mode = new DisplayMode(); mode.size = 220;
        if (!EnumDisplaySettings(null, -1, ref mode)) throw new IOException("Could not read the desktop resolution.");
        return new[] { checked((int)mode.width), checked((int)mode.height) };
    }
    public static string Repair(string file, int width, int height) {
        return Repair(file, width, height, false);
    }
    public static string Repair(string file, int width, int height, bool isolatedSettings) {
        if (width < 320 || height < 200 || width > 32768 || height > 32768) throw new ArgumentOutOfRangeException("width", "Invalid desktop resolution.");
        if (!File.Exists(file)) return null;
        byte[] original = File.ReadAllBytes(file);
        Encoding encoding = new UTF8Encoding(false);
        if (original.Length >= 2 && original[0] == 0xff && original[1] == 0xfe) encoding = Encoding.Unicode;
        else if (original.Length >= 3 && original[0] == 0xef && original[1] == 0xbb && original[2] == 0xbf) encoding = new UTF8Encoding(true);
        string text = File.ReadAllText(file, encoding);
        var section = Regex.Match(text, @"(?im)^\[/Script/FortniteGame\.FortGameUserSettings\][^\r\n]*(?:\r?\n)(?:(?!\[)[^\r\n]*(?:\r?\n|$))*");
        if (!section.Success) return null;
        var fullscreen = Regex.Match(section.Value, @"(?im)^\s*FullscreenMode\s*=\s*(\d+)\s*$");
        // 4.2 omits default-valued FullscreenMode when saving some profiles.
        if (!fullscreen.Success) fullscreen = Regex.Match(section.Value, @"(?im)^\s*LastConfirmedFullscreenMode\s*=\s*(\d+)\s*$");
        if (!fullscreen.Success || fullscreen.Groups[1].Value != "1") return null;
        string changed = Regex.Replace(section.Value, @"(?im)^([^\S\r\n]*)(ResolutionSizeX|ResolutionSizeY|LastUserConfirmedResolutionSizeX|LastUserConfirmedResolutionSizeY)([^\S\r\n]*=[^\S\r\n]*)\d+([^\S\r\n]*)(\r?)$", match =>
            match.Groups[1].Value + match.Groups[2].Value + match.Groups[3].Value + (match.Groups[2].Value.EndsWith("X", StringComparison.OrdinalIgnoreCase) ? width : height) + match.Groups[4].Value + match.Groups[5].Value);
        if (changed == section.Value) return null;
        if (!isolatedSettings && System.Diagnostics.Process.GetProcessesByName("FortniteClient-Win64-Shipping").Length > 0)
            throw new IOException("Close other Fortnite windows before preparing the 4.2 startup resolution.");
        if ((File.GetAttributes(file) & FileAttributes.ReadOnly) != 0) throw new IOException("GameUserSettings.ini is read-only. Make it writable before launching Fortnite 4.2.");
        string id = DateTime.UtcNow.ToString("yyyyMMdd-HHmmss") + "-" + Guid.NewGuid().ToString("N");
        string backup = Path.Combine(Path.GetDirectoryName(file), "GameUserSettings.before-launcher-" + id + ".ini");
        string temporary = file + ".launcher-" + id + ".tmp";
        try {
            File.WriteAllText(temporary, text.Substring(0, section.Index) + changed + text.Substring(section.Index + section.Length), encoding);
            // Avoid replacing settings that another application changed during preparation.
            if (Convert.ToBase64String(File.ReadAllBytes(file)) != Convert.ToBase64String(original)) throw new IOException("Game settings changed during preparation. Try again after closing Fortnite.");
            File.Replace(temporary, file, backup);
            return backup;
        } finally { if (File.Exists(temporary)) File.Delete(temporary); }
    }
}
