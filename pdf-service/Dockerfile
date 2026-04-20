# Playwright's official image bundles Chromium + every system lib it needs.
# This is the simplest way to get a reliable PDF renderer on Railway.
#
# KEEP IN SYNC WITH package.json's playwright version — mismatched versions
# break the runtime because the installed npm package looks for Chromium at
# a path keyed off its exact version. To bump: change BOTH this tag and the
# exact-pinned `playwright` version in package.json together.
FROM mcr.microsoft.com/playwright:v1.49.1-jammy

WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev --ignore-scripts

COPY index.js ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "index.js"]
