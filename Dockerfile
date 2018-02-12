FROM services.ub.uni-leipzig.de:10443/node:8-alpine
ENV NODE_ENV=production \
 npm_config_registry=https://services.ub.uni-leipzig.de/nexus/repository/npm/
RUN npm install -g autoconfig
ENTRYPOINT ["/usr/local/bin/autoconfig"]