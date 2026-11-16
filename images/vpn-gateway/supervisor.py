#!/usr/bin/env python3
"""Run an isolated system bus and forward a manually started VPN session's logs."""
import os
import signal
import subprocess
import sys
import time

PROFILE = "vpn-pyrl"
CONFIG = "/etc/openvpn/client/client.ovpn"
BUS_SOCKET = "/run/dbus/system_bus_socket"


def main():
    os.makedirs("/run/dbus", exist_ok=True)
    bus = subprocess.Popen(["dbus-daemon", "--system", "--nofork", "--nopidfile"])
    log = None
    stopping = False

    def stop(_signum, _frame):
        nonlocal stopping
        stopping = True

    signal.signal(signal.SIGTERM, stop)
    signal.signal(signal.SIGINT, stop)
    try:
        for _ in range(100):
            if bus.poll() is not None:
                raise RuntimeError("D-Bus exited before startup")
            if os.path.exists(BUS_SOCKET):
                break
            time.sleep(0.1)
        else:
            raise RuntimeError("D-Bus socket did not appear")

        print("Importing OpenVPN profile (credentials are entered interactively)", flush=True)
        subprocess.run(
            ["openvpn3", "config-import", "--config", CONFIG, "--name", PROFILE],
            check=True,
        )
        print("Waiting for a manually started OpenVPN 3 session", flush=True)
        while not stopping:
            if bus.poll() is not None:
                raise RuntimeError("D-Bus exited")
            if log is not None:
                if log.poll() is None:
                    time.sleep(2)
                    continue
                print("OpenVPN session log ended; waiting for a session", flush=True)
                log = None
                time.sleep(3)
            result = subprocess.run(
                ["openvpn3", "sessions-list"],
                stdout=subprocess.PIPE,
                stderr=subprocess.PIPE,
                text=True,
            )
            if result.returncode == 0 and PROFILE in result.stdout:
                print("Following OpenVPN session log", flush=True)
                log = subprocess.Popen(["openvpn3", "log", "--config", PROFILE])
            else:
                if result.returncode != 0:
                    print("Cannot query OpenVPN sessions: " + result.stderr.strip(), file=sys.stderr, flush=True)
                time.sleep(3)
    finally:
        if log is not None and log.poll() is None:
            log.terminate()
            log.wait(timeout=5)
        if bus.poll() is None:
            bus.terminate()
            bus.wait(timeout=5)


if __name__ == "__main__":
    try:
        main()
    except (RuntimeError, subprocess.CalledProcessError) as exc:
        print(f"OpenVPN supervisor failed: {exc}", file=sys.stderr, flush=True)
        sys.exit(1)
