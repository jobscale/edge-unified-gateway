FROM node:lts-trixie-slim
SHELL ["bash", "-c"]
WORKDIR /home/node
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
  ca-certificates dnsutils iproute2 curl vim \
 && apt-get clean && rm -fr /var/lib/apt/lists/*

USER node
COPY --chown=node:staff package.json .
RUN npm i --omit=dev
COPY --chown=node:staff dns dns
COPY --chown=node:staff proxy proxy
COPY --chown=node:staff db db
COPY --chown=node:staff acl acl
COPY --chown=node:staff index.js .

EXPOSE 3128
EXPOSE 3443
EXPOSE 53/tcp
EXPOSE 53/udp
CMD ["npm", "start"]
