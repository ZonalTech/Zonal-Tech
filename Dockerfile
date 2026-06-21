# Zonal Tech — fullstack image for Zonal Cloud.
#
# The repo is a Vite/React frontend (root) plus an Express API in server/ that
# ALSO serves the built frontend from ../../dist (see server/src/index.js). So
# this image: builds the frontend, installs the server, and runs the server,
# which serves both the API and the static SPA on $PORT (injected by Zonal).
#
# Why a committed Dockerfile (vs the platform's generated fallback): the root
# package.json has `postinstall: npm install --prefix server`, which needs
# server/package.json present at install time. The fallback copies only the
# root package*.json before `npm install`, so postinstall fails with ENOENT.
# Copying the whole repo first avoids that.

FROM node:20-bookworm-slim AS build
WORKDIR /app

# Copy the whole repo so the root postinstall (npm install --prefix server)
# can see server/package.json.
COPY . .

# Installs root deps AND, via postinstall, the server deps.
RUN npm install --legacy-peer-deps

# Build the React frontend into /app/dist (served by the server).
RUN npm run build

# ---------- runtime ----------
FROM node:20-bookworm-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production

# Bring over the built frontend, the server, and all node_modules (root +
# server) produced in the build stage.
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./package.json

# The server listens on $PORT (server/src/index.js). On Zonal Cloud the platform
# injects PORT and routes Traefik to it — no need to set it here. Falls back to
# the server's own default (8000) for a bare local `docker run`.

# Start the Express server (serves API + static dist/).
CMD ["node", "server/src/index.js"]
