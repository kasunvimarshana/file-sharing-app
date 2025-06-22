# # turn/Dockerfile
# FROM instrumentisto/coturn:4.5.2
# COPY turnserver.conf /etc/coturn/turnserver.conf

FROM coturn/coturn:4.6.2-alpine

# Copy configuration
COPY turnserver.conf /etc/coturn/turnserver.conf

# Create log directory
# RUN mkdir -p /var/log && chown coturn:coturn /var/log
RUN mkdir -p /var/log

# Expose ports
EXPOSE 3478/udp 3478/tcp 5349/udp 5349/tcp
EXPOSE 49152-65535/udp

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD turnutils_uclient -t -T -u username -w password 127.0.0.1 || exit 1

CMD ["-c", "/etc/coturn/turnserver.conf"]
