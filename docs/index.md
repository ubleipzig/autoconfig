# autoconfig

this program is used to set up an arbitrary software project after its deployment.
frankly it is part of the deployment process and should take over after successfully
copying all project code to the appropriate location.

the currently supported software is [vufind][1]

## installation

this package is not part of the public npm-registry. its published to the private registry
of the university library of leipzig. use this registry as follows:

    npm --registry https://docker.ub.intern.uni-leipzig.de/npm install -g autoconfig

it is recommended to install it as superuser, but it is advised to be run as non-root
though.

## run

the program is invoked by

    autoconfig

for help see the commandline help i.e.

    autoconfig help

[1]: http://vufind-org.github.io/vufind/
