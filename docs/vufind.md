# autoconfig vufind

to set up a vufind instance it has to follow some rules (although i tried to make it
as flexible as possible)

## Usage

    autoconfig help vufind

will give an overview of all possible config params

### `--basedir`

will set the folder where the vufind-app is located.

by default the folder `/usr/local/vufind/` is used

### `--instance`

will set which instance is deployed. this is really just the name of the folder,
where autoconfig saves all new config files in and which you have to set as
VUFIND_LOCAL_DIR environment variable in apache2 so vufind will use it as config folder

### `--configs`

specifies the folder where the configuration template is located which shall be set up.
the filename has to be the name of the site prefixed by the extension `.json`

by default the folder `${HOME}/.autoconfig` is used

### `--reuse-db`

if present, an existing database, but not accessable by the configured dbuser will be reused
by creating a new dbuser as configured and grant him all required rights to access the existing
database. any existing users having access to that database will be untouched.

Reusing an existing database imperatively depends on the right credentials for the database user. If the database user created by *autoconfig* is unable to connect to the database *autoconfig* will abort the process. Hint: `--db-client`

defaults to `false`

### `--drop-db`

if present, an existing database will be dropped, a user deleted and a brand new
database created. an appropriate user will be created as well.

Reusing an existing database imperatively depends on the right credentials for the database user. If the database user created by *autoconfig* is unable to connect to the database *autoconfig* will abort the process. Hint: `--db-client`

defaults to `false`

### `--hash-id`

if present, an unique md5-hash will be generated from basedir. this hash is used to identify the site by creating an autoconfig-json with this id and the site's database name and user.
the `config.ini` for this instance will be modified accordingly.

defaults to `false`

### `--restore-db`

if present, *autoconfig* will look for a backup sql-file in the folder specified by `--db-backup-dir` after creating the database for the site. if a file for the site is found it is used to create a table structure, otherwise the vanilla sql-file is used.

defaults to `true`.

### `--skip-config`

if present, creating a configuration structure based on inheritance premisses is omitted. only grunt is invoked and a database is created

defaults to `false`

### `--skip-db`

if present, creating a database is omitted. only the configuration structure is created and grunt is invoked

defaults to `false`

### `--db-backup-dir`

specifies the folder where *autoconfig* looks for backup sql-files to restore at database creation of a site.

defaults to `${HOME}/db_backup`

### `--undeploy`

specifies that the site is *undeployed* and *autoconfig* dumps the database to `--db-backup-dir` before its user and the database itself is dropped.

### `--db-server`

the specified value will be set as host that runs the db server. the value is ignored, if there is a configuration in the sites *autoconfig-json*, see `--configs`.
it is also ignored, when `--skip-config` is specified and the `config.ini` entry for the database *autoconfig* creates the database from is present.

### `--db-client`

the specified value will be set as host which the db server sees the db client as.

this is not necessarily your vufind-client`s hostname but the ip - or hostname which
the db-server resolves to that ip - which the client uses to connect to the db-server

### `--solr-url`

the specified value will be set as the url to the solr-index

### `--ai-url`

the specified value will be set as the url to the article-index

### `--url`

the specified value will be set as site-url/<site name> in config.ini

## Example

lets say we want to set up the site **foo**. the **staging** folder of this site is named
alike and is located in `/var/lib/vufind/`, the database-server and the ai-index url to use
are the same for each site, the solr-url is different, so we specify that by adjusting
the site's configuration later.

the configurations do not exist, but we want to create them whilest processing.
we would to so as following:

    autoconfig vufind \
      -i staging \
      -b /var/lib/vufind/foo \
      --url https://staging.vufind.example.com/foo
      --db-server mysql.example.com \
      --db-client staging.vufind.example.com \
      --ai-url ai.vufind.example.com/biblio \
      foo

*autoconfig* now looks for all configuration files within `/var/lib/vufind/foo/foo/config/vufind/`
 and and language files within `/var/lib/vufind/foo/foo/languages/`.

 Config files which ends to `.ini` are considered do be inheritable and therefore *autoconfig*
 creates new files in `/var/lib/vufind/foo/foo/staging/config/vufind/` with the same name
 and a parent-config setting as vufind supports it, which inherits the related config-file.

 The next step is to create a database according to the specified credentials. since there
 are none specified (which is for now only possible by providing a configuration template,
 see `configs`) *autoconfig* creates a dbuser `vufind_foo`, a database `vufind_foo` and
 a random password. To be able to do so the user that runs *autoconfig* needs a `.my.cnf` in
 its home folder that specifys the sufficient credentials to log into the server, create
 databases and users.

 now *autoconfig* writes the autogenerated database credentials, the specified ai-url and
 some default values in the *staging* config files.

 because there is no configuration template for this site yet *autoconfig* creates one and
 writes all configuration values as json-object. the file looks like that

    {
      "DAIA.ini": {},
      "FincILS.ini": {},
      "HierarchyDefault.ini": {},
      "SolrAI.ini": {},
      "config.ini": {
        "Database": {
          "database": "mysql://vufind_foo:U57jeRyw8mT7Vl9v@mysql.example.com/vufind_foo"
        },
        "Index": {
          "url": "http://172.18.113.250:8080/solr"
        },
        "Authentication": {
          "ils_encryption_key": "gef36739fc553b9c41e802g4c440eb0bba1cd326"
        },
        "Site": {
          "url": "https://staging.vufind.example.com/foo"
        }
      },
      "facets.ini": {},
      "searches.ini": {
        "IndexShards": {
          "ai": "ai.vufind.example.com/biblio"
        },
        "ShardPreferences": {
          "showCheckboxes": true
        }
      }
    }

you can also see some configuration which is not defined by parameters at commandline.
these are default values which appear to be required or useful.

to change the configuration of the site simply edit the template and do another

    autoconfig vufind \
      -i staging \
      -b /var/lib/vufind/foo \
			--db-client staging.vufind.example.com \
      foo

since all configuration is now provided by the site template we do not need to provide
configuration values by commandline parameters. **in fact all configuration values from
the site's configuration template have precedence of the commandline parameters.
if you want autoconfig to take the values from commandline parameters you have to delete them
from the configuration template first.**


## Todo

* support for yaml format
* overwriting configuration template when commandline parameters are provided
* tests
* make it more generic usable