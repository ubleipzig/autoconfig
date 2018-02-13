FROM services.ub.uni-leipzig.de:10443/node:8-alpine
# needed for node-gyp (sass-compiling) which in turn is needed for vufind's grunt-job
# consider installing this package globally?
RUN apk add --no-cache python make g++
ENV NODE_ENV=production \
 npm_config_registry=https://services.ub.uni-leipzig.de/nexus/repository/npm/
RUN npm install -g autoconfig
ENTRYPOINT ["/usr/local/bin/autoconfig"]