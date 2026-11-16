import importlib.util
import subprocess
import unittest
from pathlib import Path
from unittest.mock import Mock, patch


spec = importlib.util.spec_from_file_location("vpn_supervisor", Path(__file__).with_name("supervisor.py"))
supervisor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supervisor)


class SupervisorTest(unittest.TestCase):
    def test_imports_profile_waits_for_session_and_stops_children(self):
        bus = Mock()
        bus.poll.return_value = None
        log = Mock()
        log.poll.return_value = None
        handlers = {}
        commands = []

        def run(command, **kwargs):
            commands.append(command)
            if command[1] == "sessions-list":
                return subprocess.CompletedProcess(command, 0, stdout="Config name: vpn-pyrl", stderr="")
            return subprocess.CompletedProcess(command, 0)

        def sleep(_seconds):
            handlers[supervisor.signal.SIGTERM](None, None)

        with patch.object(supervisor.os, "makedirs"), \
             patch.object(supervisor.os.path, "exists", return_value=True), \
             patch.object(supervisor.signal, "signal", side_effect=lambda sig, handler: handlers.update({sig: handler})), \
             patch.object(supervisor.subprocess, "Popen", side_effect=[bus, log]) as popen, \
             patch.object(supervisor.subprocess, "run", side_effect=run), \
             patch.object(supervisor.time, "sleep", side_effect=sleep):
            supervisor.main()

        self.assertEqual(commands[0][1], "config-import")
        self.assertEqual(commands[1][1], "sessions-list")
        self.assertEqual(popen.call_args_list[1].args[0], ["openvpn3", "log", "--config", "vpn-pyrl"])
        log.terminate.assert_called_once()
        bus.terminate.assert_called_once()

    def test_reports_dbus_startup_failure(self):
        bus = Mock()
        bus.poll.return_value = 1
        with patch.object(supervisor.os, "makedirs"), \
             patch.object(supervisor.signal, "signal"), \
             patch.object(supervisor.subprocess, "Popen", return_value=bus):
            with self.assertRaisesRegex(RuntimeError, "D-Bus exited before startup"):
                supervisor.main()


if __name__ == "__main__":
    unittest.main()
