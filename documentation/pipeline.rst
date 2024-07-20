===============================
DepMap Pipeline
===============================


Overview
-------------------------------
To be written


Dependencies and Installation
-------------------------------
Check out the `conseq repo <https://stash.broadinstitute.org/projects/CPDS/repos/conseq/browse>`_. and run ``python3 setup.py develop`` to install.

Check out the `dsub repo <https://github.com/googlegenomics/dsub>`_.
Create a separate environment with python 2, and from the checked out repo install dsub::
	conda create -n depmap-dsub python=2.7
	cd dsub
	python setup.py install

Follow the instructions `here <https://cloud.google.com/sdk/downloads#interactive>`_ to install gcloud. Then run the following to authenticate ::
	gcloud auth login <your email>
	gcloud application-default login

Create a .conseq file in your home directory, filling in the fields ::

	let TAIGA_URL = "http://taiga.broadinstitute.org"
	let DSUB_PATH = ""
	let AWS_ACCESS_KEY_ID = ""
	let AWS_SECRET_ACCESS_KEY = ""

Where DSUB_PATH is the path to dsub as just created above, e.g. ``"/Users/jshlee/anaconda/envs/depmap-dsub/bin/dsub"``.

Running Conseq
-------------------------------
Refer to the `depcon readme <https://stash.broadinstitute.org/projects/CPDS/repos/depcon/browse?at=refs%2Fheads%2Fmulti-context>`_, ingnoring mentions of a virtual machine

Pulling the conseq docker image for local dev
---------------------------------------------
::
	gcloud docker --authorize-only
	docker pull us.gcr.io/broad-achilles/conseq

