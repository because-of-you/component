FROM debian:bookworm-slim

RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates curl dbus iproute2 iptables python3 tini \
    && mkdir -p /etc/apt/keyrings \
    && curl -fsSL https://packages.openvpn.net/packages-repo.gpg -o /etc/apt/keyrings/openvpn.asc \
    && echo 'deb [signed-by=/etc/apt/keyrings/openvpn.asc] https://packages.openvpn.net/openvpn3/debian bookworm main' > /etc/apt/sources.list.d/openvpn3.list \
    && apt-get update \
    && apt-get install -y --no-install-recommends openvpn3-client \
    && rm -rf /var/lib/apt/lists/*

COPY supervisor.py /usr/local/bin/vpn-supervisor
ENTRYPOINT ["/usr/bin/tini", "--", "python3", "-u", "/usr/local/bin/vpn-supervisor"]
