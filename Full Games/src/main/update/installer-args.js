'use strict';

function quoteWindowsPath(value) {
  const text = String(value);
  if (text.includes('"')) throw new Error('Недопустимая кавычка в пути установщика.');
  return '"' + text + '"';
}

function msiexecArguments(msiPath, logPath) {
  return '/i ' + quoteWindowsPath(msiPath) +
    ' /passive /norestart ALLUSERS=1 REBOOT=ReallySuppress /L*v ' + quoteWindowsPath(logPath);
}

function powershellFileArguments(scriptPath) {
  return '-NoProfile -ExecutionPolicy Bypass -File ' + quoteWindowsPath(scriptPath);
}

module.exports = { msiexecArguments, powershellFileArguments };
