FROM node:24.13.0-alpine AS builder
ARG NPM_TOKEN

WORKDIR /app
COPY . .
RUN npm ci
RUN npm run build && ls -l
RUN npm prune --prod

FROM node:24.13.0-alpine
WORKDIR /app
COPY --from=builder /app ./

# Create a group and user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup
RUN chgrp -R appgroup * && chmod -R g+rw *
# Tell docker that all future commands should run as the appuser user
USER appuser

# CMD sh -c 'npx sequelize-cli db:migrate --url=postgresql://$DB_USERNAME:$DB_PASSWORD@$DB_HOST:$DB_PORT/$DB_DATABASE' && npm run start:prod
CMD ["npm", "run", "start:prod"]

