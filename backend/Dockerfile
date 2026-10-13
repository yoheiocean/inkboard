# PocketBase for Inkboard: users, folders, drawings and uploaded images.
FROM alpine:3.22

ARG PB_VERSION=0.40.4
# From the release's checksums.txt
ARG PB_SHA256_AMD64=9042ec818570e79c3628dadcd0a756c1496d9e1173918ec409d133c02f82e5fa
ARG PB_SHA256_ARM64=86095bf8ed9345954f0d2bf0a5fb9b57584ae60b77ebf3b6cd23a8003a3fd418
ARG TARGETARCH

RUN set -eu; \
    apk add --no-cache ca-certificates su-exec; \
    case "${TARGETARCH:-amd64}" in \
      amd64) arch=amd64; sum="$PB_SHA256_AMD64" ;; \
      arm64) arch=arm64; sum="$PB_SHA256_ARM64" ;; \
      *) echo "unsupported architecture: $TARGETARCH" >&2; exit 1 ;; \
    esac; \
    wget -q -O /tmp/pb.zip "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_${arch}.zip"; \
    echo "$sum  /tmp/pb.zip" | sha256sum -c -; \
    unzip -q /tmp/pb.zip pocketbase -d /usr/local/bin; \
    rm /tmp/pb.zip; \
    adduser -D -H -u 10001 pocketbase; \
    mkdir -p /pb_data

COPY pb_migrations /pb_migrations
COPY pb_hooks /pb_hooks
COPY entrypoint.sh /entrypoint.sh
# `docker compose exec pocketbase pb <command>` runs PocketBase commands against the data dir.
RUN printf '#!/bin/sh\nexec /bin/sh /entrypoint.sh "$@"\n' > /usr/local/bin/pb && chmod 755 /usr/local/bin/pb

EXPOSE 8090
HEALTHCHECK --interval=30s --timeout=3s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8090/api/health >/dev/null || exit 1
ENTRYPOINT ["/bin/sh", "/entrypoint.sh"]
CMD ["serve"]
