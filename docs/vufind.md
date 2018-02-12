# autoconfig vufind

Set up a vufind instance without having config files created or edited manually. *autoconfig* assumes that you have an initial configuration structure in the folder specified by `--basedir`, e.g.:
```
mySite/
├── config
│   └── vufind
│       ├── config.ini
        .
└── languages
    ├── de.ini
    ├── Ebsco
    │   ├── de.ini
    │   └── en.ini
    ├── en.ini
    .

```

*autoconfig* will then extend the folder `mySite` by a new folder specified by `--instance` that creates a new config-structure which inherits from the site's configs, e.g.:
```
mySite/
├── live
│   ├── config
│   │   └── vufind
│   │       ├── config.ini
│   |       .
│   └── languages
│       ├── de.ini
│       ├── Ebsco
│       │   ├── de.ini
│       │   └── en.ini
│       ├── en.ini
│       .
├── config
│   └── vufind
│       ├── config.ini
        .
└── languages
    ├── de.ini
    ├── Ebsco
    │   ├── de.ini
    │   └── en.ini
    ├── en.ini
    .

```

You can customize the contents of the config-files by adding commandline-arguments like this:
```
--vf.config_ini.Site.title="My Awesome VuFind"
```

Alternatively one can add environment variables to add or modify configuration values like this:
```
export VF_config_ini__Site__title="My Awesome VuFind"
```

_Both examples will add or overwrite the key `title` in section `Site` in config-file `config.ini`_


## deploy
To set up a vufind instance it has to follow some rules (although i tried to make it
as flexible as possible)

### Usage

    autoconfig vufind deploy -s mySite -i live

will set up VuFind, assuming your installation lies under `/usr/local/vufind` and you have an configuration-folder `mySite`in there.

### Options

* `--site`: The name of the site to set up. Required.
* `--instance`: The instance to deploy. Required, choose from *alpha*, *staging', *live*.
* `--basedir`: Will set the folder where the vufind-app is located. By default the
folder `/usr/local/vufind/` is used.
* `--instance`: Will set which instance is deployed. This is really just the name of the folder,
where autoconfig saves all new config files in and which you have to set as
VUFIND_LOCAL_DIR environment variable in apache2 so vufind will use it as config folder
* `--db-backup-dir`: The folder for database-backups.

* `--configs`: Specifies the folder where the configuration template is located which shall be
set up. The filename has to be the name of the site prefixed by the extension `.json`.
By default the folder `${HOME}/.autoconfig` is used.
* `--reuse-db`: if present, an existing database will be reused by creating a new dbuser as
configured and grant him all required rights to access the existing database.
Any existing users having access to that database will be untouched.
Reusing an existing database imperatively depends on the right credentials for the database user.
If the database user created by *autoconfig* is unable to connect to the database *autoconfig*
will abort the process. Hint: `--db-client`. Defaults to `false`.
* `--drop-db`: If present, an existing database will be dropped, a user deleted and a brand new
database created. An appropriate user will be created as well.
Reusing an existing database imperatively depends on the right credentials for the database user.
If the database user created by *autoconfig* is unable to connect to the database *autoconfig*
will abort the process. Hint: `--db-client`. Defaults to `false`.
* `--hash-id`: If present, an unique md5-hash will be generated from basedir. this hash is used
to identify the site by creating an autoconfig-json with this id and the site's database name
and user. Defaults to `false`
* `--restore-db`: If present, *autoconfig* will look for a backup sql-file in the folder specified
by `--db-backup-dir` after creating the database for the site. If a file for the site is found it
is used to create a table structure, otherwise the vanilla sql-file is used. Defaults to `true`.
* `--skip-config`: If present, creating a configuration structure based on inheritance premisses
is omitted. Defaults to `false`
* `--skip-db`: If present, creating a database is omitted. only the configuration structure is
created and grunt is invoked. Defaults to `false`.
* `--db-backup-dir`: Specifies the folder where *autoconfig* looks for backup sql-files to restore
at database creation of a site. Defaults to `${HOME}/db_backup`.
* `--db-server`: The specified value will be set as host that runs the db server. the value is
ignored, if there is a configuration in the sites *autoconfig-json*, see `--configs`. It is also
ignored, when `--skip-config` is specified and the `config.ini` entry for the database *autoconfig*
creates the database from is present.
* `--db-client`: The specified value will be set as host which the db server sees the db client as.
Tthis is not necessarily your vufind-client`s hostname but the ip - or hostname which the db-server
resolves to that ip - which the client uses to connect to the db-server.
* `--update-settings`: Creates the defaults file or updates if it exists. See `--configs`.
Defaults to `false`

**Be aware that the option `--db-server` is only effective if there is no `config.ini` with an
existing database configuration. Otherwise the already configured database-credentials are used.
You could override them by specifying `--vf.config_ini.Database.database`, but this removes the
ability to create a database by hash (see `--hash-id`).**

**Be aware that you *always* have to specify `--db-client` if your database-server is not the same
host as the php-server. This option is used for creating and removing the database-user and
therefore not stored in any vufind configuration.**

## Undeploy

Removes the database of a site. *Does not remove its configuration.*
```
autoconfig vufind undeploy -s foo -i alpha
```
_This creates a backup of the database of site foo_

## Example

lets say we want to set up the site **foo**. The **staging** folder of this site is named
alike and is located in `/var/lib/vufind/`, the database-server and the ai-index url to use
are the same for each site, the solr-url is different, so we specify that by adjusting
the site's configuration later.

the configurations do not exist, but we want to create them whilest processing.
we would to so as following:
```
autoconfig vufind deploy \
  -i staging \
  -s foo
  -b /var/lib/vufind/foo \
  --vf.config_ini.Site.url https://staging.vufind.example.com/foo \
  --db-server mysql.example.com \
  --db-client staging.vufind.example.com
```

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
```json
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
```

you can also see some configuration which is not defined by parameters at commandline.
these are default values which appear to be required or useful.

to change the configuration of the site simply edit the template and do another
```
autoconfig vufind \
  -i staging \
  -b /var/lib/vufind/foo \
  --db-client staging.vufind.example.com \
  foo
```
since all configuration is now provided by the site template we do not need to provide
configuration values by commandline parameters. **in fact all configuration values from
the site's configuration template have precedence of the commandline parameters.
if you want autoconfig to take the values from commandline parameters you have to delete them
from the configuration template first.**


## Todo

* support for yaml format
* make it more generic usable