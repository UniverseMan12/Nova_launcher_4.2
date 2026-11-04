using System;
using System.IO;
using System.Text;
using System.Globalization;
using System.Collections.Generic;

// Fortnite versions and the headless host must not overwrite each other's
// display settings or cloud cache. Only migrate compatible display preferences;
// the existing shared Saved directory remains untouched.
public static class LegacyGameData
{
    static readonly string[] displayKeys = {
        "FullscreenMode", "LastConfirmedFullscreenMode", "PreferredFullscreenMode",
        "ResolutionSizeX", "ResolutionSizeY", "LastUserConfirmedResolutionSizeX", "LastUserConfirmedResolutionSizeY",
        "FrameRateLimit", "bUseVSync", "bUseDynamicResolution"
    };
    static readonly string[] qualityKeys = {
        "sg.ResolutionQuality", "sg.ViewDistanceQuality", "sg.AntiAliasingQuality", "sg.ShadowQuality",
        "sg.PostProcessQuality", "sg.TextureQuality", "sg.EffectsQuality", "sg.FoliageQuality"
    };
    static bool Number(string value, double min, double max, bool integer) {
        if (integer) {
            int whole;
            return int.TryParse(value,NumberStyles.Integer,CultureInfo.InvariantCulture,out whole) && whole>=min && whole<=max;
        }
        double number;
        return double.TryParse(value, NumberStyles.Float, CultureInfo.InvariantCulture, out number) &&
            !double.IsNaN(number) && !double.IsInfinity(number) && number >= min && number <= max;
    }
    static bool Compatible(string key, string value) {
        if (key == "bUseVSync" || key == "bUseDynamicResolution") return value == "True" || value == "False" || value == "true" || value == "false";
        if (key.EndsWith("FullscreenMode", StringComparison.Ordinal)) return Number(value,0,2,true);
        if (key.EndsWith("ResolutionSizeX", StringComparison.Ordinal) || key.EndsWith("ResolutionSizeY", StringComparison.Ordinal)) return Number(value,320,32768,true);
        if (key == "FrameRateLimit") return Number(value,0,1000,false);
        if (key == "sg.ResolutionQuality") return Number(value,10,100,false);
        return key.StartsWith("sg.", StringComparison.Ordinal) && Number(value,0,3,true);
    }
    public static string InitialSettings(string existing, bool client) {
        var display = new Dictionary<string,string>(StringComparer.Ordinal);
        var quality = new Dictionary<string,string>(StringComparer.Ordinal);
        if (client && existing != null && existing.Length <= 1024*1024) {
            string section = "";
            foreach (string line in existing.Split('\n')) {
                string text=line.Trim();
                if (text.StartsWith("[", StringComparison.Ordinal)) { section=text; continue; }
                int separator=text.IndexOf('='); if(separator<1) continue;
                string key=text.Substring(0,separator).Trim(), value=text.Substring(separator+1).Trim();
                if (section=="[/Script/FortniteGame.FortGameUserSettings]" && Array.IndexOf(displayKeys,key)>=0 && Compatible(key,value)) display[key]=value;
                if (section=="[ScalabilityGroups]" && Array.IndexOf(qualityKeys,key)>=0 && Compatible(key,value)) quality[key]=value;
            }
        }
        if (!display.ContainsKey("FullscreenMode")) display["FullscreenMode"] = display.ContainsKey("LastConfirmedFullscreenMode") ? display["LastConfirmedFullscreenMode"] : "2";
        if (!display.ContainsKey("LastConfirmedFullscreenMode")) display["LastConfirmedFullscreenMode"] = display["FullscreenMode"];
        foreach (string key in new[]{"ResolutionSizeX","LastUserConfirmedResolutionSizeX"}) if(!display.ContainsKey(key)) display[key]="1280";
        foreach (string key in new[]{"ResolutionSizeY","LastUserConfirmedResolutionSizeY"}) if(!display.ContainsKey(key)) display[key]="720";
        var result=new StringBuilder("[/Script/FortniteGame.FortGameUserSettings]\r\nVersion=5\r\nFortVersion=2\r\n");
        foreach(string key in displayKeys) if(display.ContainsKey(key)) result.Append(key).Append('=').Append(display[key]).Append("\r\n");
        result.Append("\r\n[ScalabilityGroups]\r\n");
        foreach(string key in qualityKeys) if(quality.ContainsKey(key)) result.Append(key).Append('=').Append(quality[key]).Append("\r\n");
        return result.ToString();
    }
    public static string Prepare(string dataRoot, string role, string oldSettings) {
        if (role!="client" && role!="server") throw new ArgumentException("Unknown game role.");
        if (!Path.IsPathRooted(dataRoot)) throw new ArgumentException("An absolute game-data directory is required.");
        string userDirectory=Path.Combine(Path.GetFullPath(dataRoot),"4.2",role);
        string directory=Path.Combine(userDirectory,"Saved","Config","WindowsClient");
        Directory.CreateDirectory(directory);
        string file=Path.Combine(directory,"GameUserSettings.ini");
        if (File.Exists(file)) return userDirectory;
        string previous=null;
        if (role=="client" && File.Exists(oldSettings)) {
            var info=new FileInfo(oldSettings);
            if (info.Length<=1024*1024) previous=File.ReadAllText(oldSettings);
        }
        string temporary=file+"."+Guid.NewGuid().ToString("N")+".tmp";
        try {
            File.WriteAllText(temporary,InitialSettings(previous,role=="client"),new UTF8Encoding(false));
            try { File.Move(temporary,file); }
            catch(IOException) { if(!File.Exists(file)) throw; }
        } finally { if(File.Exists(temporary)) File.Delete(temporary); }
        return userDirectory;
    }
}
