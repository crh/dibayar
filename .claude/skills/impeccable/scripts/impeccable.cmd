@echo off
setlocal
rem Impeccable launcher (Windows) -- DISABLED in this repository.
rem
rem MODIFIED from the upstream Impeccable 4.5.2 launcher (Apache-2.0, see
rem ..\LICENSE and ..\NOTICE.md) by the Dibayar project on 2026-10-10: the
rem upstream download-and-run logic was removed and replaced by this stub,
rem which never runs or downloads an engine binary.
rem
rem Why: the POSIX launcher next to this file runs an engine only after its
rem SHA-256 matches a digest committed in engine-digests.txt and it reports
rem the version in VERSION. The equivalent cmd.exe logic could not be
rem executed or tested when this was written (no Windows machine), and the
rem upstream launcher trusts IMPECCABLE_BIN, the sibling binary, the cache
rem and PATH without that check. Until a Windows launcher with the same
rem checks has been written AND tested on Windows, and a windows-x64 digest
rem has been added to engine-digests.txt, this platform fails closed.
rem
rem See docs/tooling/IMPECCABLE.md, "Trusting an engine binary".
echo impeccable: the Windows launcher is disabled in this repository; no engine binary was run. 1>&2
echo The digest-and-version checks enforced by the POSIX launcher have not been ported to and tested on cmd.exe. 1>&2
echo Use the POSIX launcher (scripts/impeccable) on Linux, macOS or WSL, or follow "Trusting an engine binary" in docs/tooling/IMPECCABLE.md. 1>&2
exit /b 127
