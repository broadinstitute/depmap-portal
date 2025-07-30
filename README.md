# DepMap

The DepMap website enables scientists to perform analyses to identify
cancer dependencies and answer scientific questions about DepMap data.

## Quickstart

The DepMap Portal codebase is a monorepo conisting of at least a few important modules:
* **Breadbox**: a service for storing and retrieving data displayed on the DepMap portal. 
    * Breadbox uses a more updated data model and stores most of the data displayed in visualizations on the portal. 
    * More breadbox documentation [here](breadbox/README.md)
    * Documentation about our data model and terminology can be found [here](breadbox/docs/terminology.md)
* **"legacy" portal backend**: a service with a transient database (rebuilt each deployment)
    * This API also serves information about all of our downloads to the frontend
    * More portal backend documentation [here](portal-backend/README.md)
* **Frontend**: The portal's mostly-React frontend
    * More documentation [here](frontend/README.md)
* **Pipeline**: The portal's preprocessing pipeline
    * More documentation [here](pipeline/README.md)


## Deployments

A map of the deployments:
<https://www.lucidchart.com/documents/edit/1f07be74-dd59-4fd2-ba27-f4b7091687ad/0?shared=true&>

Google doc:
<https://docs.google.com/document/d/1M9K6WkJQo5_9DDXnJWTUZQhE37wxZDCpIIfVZmM_Blg/edit>

Instructions per quarter:
<https://app.asana.com/0/1156387482589290/1156388333407152>

Behind the scenes:

A deployment consists of a tagged docker image and set of files which
contain data (and the primary sqlite database).

To minimize downtime, we perform the deploy in the following steps:

1\. Clicking \"build db\" for a given environment runs a sparkles job
which runs the \"flask recreate_full_db\" command and uploads the
resulting data dir as the sparkles job output. The \"recreate_full_db\"
command pulls the needed data from S3 based on the `S3_DIR`
config variable in the settings for the given environment.

2.  Once we have a copy of the database stored on the cloud, we can run
    a \"deploy to staging\" jenkins job.

We have the choice of upgrading the existing database (that is running
the checkpoints via \"flask recreate_full_db\") or downloading a fresh
database from the sparkles job output.

The upgrade and reload commands execute within a docker image that is
for the new version of the portal. See the deployment diagram for which
docker tag is used for which environment.

3\. After the upgrade of the DB is complete, the staging job will copy
the filesystem folder to a temporary location. (It does a copy to ensure
the data is on the same volume as where the official instance lives so
that the directory rename can be done quickly.)

4\. Next, we tag the docker image we used with the same name but adding
the suffix \"-deployed\" (This is effectively swapping which version of
the portal\'s software we are using.) The systemd service which starts
the portal runs the docker image with the \"-deployed\" suffix.

5\. Lastly, stop the running portal, delete the existing data folder,
rename the temporary folder to \"data\", and start the portal again.

After verifying the staging environment looks good, we can promote the
deployment to production by running another \"copy to prod\" jenkins
job. Again the data directory is copied and the docker image in use is
tagged changing \"staging\" to \"prod\", and the website bounced to let
the changes take effect.

For example, if one makes a change to skyros, that change must be on the
\"internal\" branch. Deploying to internal staging will tag the latest
docker image tagged \"internal\" as \"istaging-deployed\" if the deploy
is successful. Then if staging gets promoted to prod the docker image
\"istaging-deployed\" also gets tagged as \"iprod-deployed\".

## Simulating a deployment for development

For our actual deployments, we use docker compose to start the various
containers and get them talking to one another. We can do this locally
for testing by first building a docker image tagged as `depmap`:

```
bash build-docker-image.sh depmap
```

Next, we can use the docker-compose.yaml file to start all of the services:

```
docker-compose up
```

The portal should then be up and listening on http://127.0.0.1:5000
