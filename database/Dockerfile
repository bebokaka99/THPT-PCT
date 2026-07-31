FROM postgres:18.4-alpine3.23

RUN apk upgrade --no-cache \
  && apk add --no-cache su-exec \
  && sed -i 's/exec gosu postgres/exec su-exec postgres/' \
    /usr/local/bin/docker-entrypoint.sh \
  && rm -f /usr/local/bin/gosu
