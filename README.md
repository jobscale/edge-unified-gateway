# edge-unified-gateway

## build
```
docker build . -t local/edge-unified-gateway
```

## run
```
docker run --rm -p 127.0.0.53:5353:53/udp -it local/edge-unified-gateway
```

## check
```
dig jsx.jp @127.0.0.53 -p 5353
dig proxy.x.jsx.jp @127.0.0.53 -p 5353
dig n100.jsx.jp @127.0.0.53 -p 5353
dig proxy.us.jsx.jp @127.0.0.53 -p 5353
dig s.jsx.jp @127.0.0.53 -p 5353
dig github.io @127.0.0.53 -p 5353
dig amazonaws.com @127.0.0.53 -p 5353
```
