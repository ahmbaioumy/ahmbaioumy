; Inno Setup script stub for WFM Planning Suite
; Build on Windows with Inno Setup 6.x
; Requires PyInstaller bundle in dist/wfm-planning/

[Setup]
AppName=WFM Planning Suite
AppVersion=0.1.0
DefaultDirName={localappdata}\WFM Planning Suite
PrivilegesRequired=lowest
OutputBaseFilename=WFM-Planning-Suite-Setup

[Files]
; Source: "dist\wfm-planning\*"; DestDir: "{app}"; Flags: recursesubdirs

[Icons]
Name: "{group}\WFM Planning Suite"; Filename: "{app}\wfm-planning.exe"
