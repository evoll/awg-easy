# ---------- Stage 1: Build Web UI ----------
FROM node:22-alpine AS build
WORKDIR /app/src

# Установим corepack и pnpm
ARG PNPM_VERSION=10.19.0
RUN corepack enable && corepack prepare pnpm@${PNPM_VERSION} --activate

# Копируем только package.json и lock-файл, чтобы кешировать зависимости
COPY src/package.json src/pnpm-lock.yaml ./

# Устанавливаем зависимости (без --frozen-lockfile, чтобы не ломалось при мелких расхождениях)
RUN pnpm install --no-frozen-lockfile

# Копируем весь исходный код
COPY src .

# Добавляем postcss.config.js, если отсутствует
RUN test -f postcss.config.js || \
    echo 'export default { plugins: { "@tailwindcss/postcss": {}, autoprefixer: {} } };' > postcss.config.js

# Собираем Nuxt-приложение
RUN pnpm build


# ---------- Stage 2: Build amneziawg-tools ----------
FROM alpine:3.22 AS tools
WORKDIR /build
RUN apk add --no-cache linux-headers build-base git
RUN git clone https://github.com/amnezia-vpn/amneziawg-tools.git
WORKDIR /build/amneziawg-tools/src
RUN make


# ---------- Stage 3: Build AmneziaWG Kernel Module ----------
FROM alpine:3.22 AS kernel_module_builder
WORKDIR /build

RUN apk add --no-cache git linux-lts-dev build-base bc elfutils-dev wget xz

# Получаем актуальную версию ядра
RUN KERNEL_VERSION=$(apk info linux-lts-dev | grep 'linux-lts-dev-' | sed 's/linux-lts-dev-//;s/-r.*//' | head -1) && \
    echo "$KERNEL_VERSION" > /build/kernel_version.txt && \
    echo "Building for kernel: $KERNEL_VERSION"

# Клонируем и собираем модуль
RUN git clone https://github.com/amnezia-vpn/amneziawg-linux-kernel-module.git
WORKDIR /build/amneziawg-linux-kernel-module/src
RUN KERNEL_VERSION=$(cat /build/kernel_version.txt) && \
    make KERNELDIR="/usr/src/linux-headers-${KERNEL_VERSION}-0-lts" || \
    echo "Kernel module build failed, will use userspace fallback"

# Готовим модуль к копированию
RUN mkdir -p /build/module && \
    if [ -f amneziawg.ko ]; then cp amneziawg.ko /build/module/; fi


# ---------- Stage 4: Final Runtime Image ----------
FROM node:22-alpine
WORKDIR /app

# Копируем собранный UI
COPY --from=build /app/src/.output /app

# Копируем миграции
COPY --from=build /app/src/server/database/migrations /app/server/database/migrations

# libsql workaround
RUN cd /app/server && npm install --no-save libsql && npm cache clean --force

# CLI
COPY --from=build /app/src/cli/cli.sh /usr/local/bin/cli
RUN chmod +x /usr/local/bin/cli

# amneziawg-tools
COPY --from=tools /build/amneziawg-tools/src/wg /usr/bin/awg
COPY --from=tools /build/amneziawg-tools/src/wg-quick/linux.bash /usr/bin/awg-quick
RUN chmod +x /usr/bin/awg /usr/bin/awg-quick

# Kernel module
COPY --from=kernel_module_builder /build/module /lib/modules/
COPY --from=kernel_module_builder /build/kernel_version.txt /etc/amneziawg-kernel-version.txt

# Linux packages
RUN apk add --no-cache \
    dpkg dumb-init iptables ip6tables nftables kmod \
    iptables-legacy wireguard-tools

# Настраиваем iptables-legacy
RUN update-alternatives --install /usr/sbin/iptables iptables /usr/sbin/iptables-legacy 10 \
    --slave /usr/sbin/iptables-restore iptables-restore /usr/sbin/iptables-legacy-restore \
    --slave /usr/sbin/iptables-save iptables-save /usr/sbin/iptables-legacy-save && \
    update-alternatives --install /usr/sbin/ip6tables ip6tables /usr/sbin/ip6tables-legacy 10 \
    --slave /usr/sbin/ip6tables-restore ip6tables-restore /usr/sbin/ip6tables-legacy-restore \
    --slave /usr/sbin/ip6tables-save ip6tables-save /usr/sbin/ip6tables-legacy-save

# Настройки окружения
ENV DEBUG=Server,WireGuard,Database,CMD
ENV PORT=51821
ENV HOST=0.0.0.0
ENV INSECURE=false
ENV INIT_ENABLED=false
ENV DISABLE_IPV6=false

# Healthcheck
HEALTHCHECK --interval=1m --timeout=5s --retries=3 CMD /usr/bin/timeout 5s /bin/sh -c "/usr/bin/awg show | /bin/grep -q interface || exit 1"

LABEL org.opencontainers.image.source="https://github.com/evoll/awg-easy"

# Запуск Web UI
CMD ["/usr/bin/dumb-init", "node", "server/index.mjs"]
