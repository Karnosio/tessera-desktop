FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates curl git xz-utils build-essential pkg-config openssl python3 libglib2.0-0 && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://nodejs.org/dist/v26.7.0/node-v26.7.0-linux-x64.tar.xz | tar -xJ -C /opt && ln -s /opt/node-v26.7.0-linux-x64 /opt/node
ENV PATH=/opt/node/bin:/opt/go/bin:/opt/cargo/bin:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
RUN npm install -g pnpm@11.13.0
RUN curl -fsSL https://go.dev/dl/go1.26.10.linux-amd64.tar.gz | tar -xz -C /opt
ENV RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo
RUN curl -fsSL https://sh.rustup.rs | sh -s -- -y --profile minimal --default-toolchain 1.88.0
RUN chmod -R a+rwX /opt/rustup /opt/cargo
ENV HOME=/work/.home GOPATH=/work/.gopath GOCACHE=/work/.gocache pnpm_config_store_dir=/work/.pnpm-store ELECTRON_CACHE=/work/.electron ELECTRON_BUILDER_CACHE=/work/.electron-builder
WORKDIR /work/sing-box-for-desktop
RUN curl -fsSLO http://deb.debian.org/debian/pool/main/o/openssl/libssl1.1_1.1.1w-0+deb11u1_amd64.deb && dpkg -i libssl1.1_1.1.1w-0+deb11u1_amd64.deb && rm libssl1.1_1.1.1w-0+deb11u1_amd64.deb
RUN dpkg --add-architecture i386 && apt-get update && apt-get install -y --no-install-recommends wine wine32:i386 wine64 && rm -rf /var/lib/apt/lists/*
ENV WINEDEBUG=-all
