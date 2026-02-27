Set WshShell = CreateObject("WScript.Shell")
WshShell.Run "cmd.exe /c npm run electron:dev", 0, False
