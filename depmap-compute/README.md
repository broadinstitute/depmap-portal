# Depmap Compute

Code related to computations and analyses. Used in both Depmap Portal and BreadBox

### To publish a new version:

To setup for publishing (Based on https://medium.com/google-cloud/python-packages-via-gcps-artifact-registry-ce1714f8e7c1 )

```
poetry self add keyrings.google-artifactregistry-auth
poetry config repositories.public-python https://us-central1-python.pkg.dev/cds-artifacts/public-python/
# also make sure you've authentication via "gcloud auth login" if you haven't already
```

And then you can bump the version and publish via:

```
poetry version patch
poetry publish --build --repository public-python
```

If this gives you an authentication error, you can investigate by running
the command again with debugging output by adding `-vvv`:

```
poetry publish --build --repository public-python -vvv
```

In the output, look for the list of keyring backends that are installed. The
below is an example of a working setup:

```
Checking if keyring is available
[keyring:keyring.backend] Loading Google Auth
[keyring:keyring.backend] Loading KWallet
[keyring:keyring.backend] Loading SecretService
[keyring:keyring.backend] Loading Windows
[keyring:keyring.backend] Loading chainer
[keyring:keyring.backend] Loading libsecret
[keyring:keyring.backend] Loading macOS
```

If `Loading Google Auth` is missing, you have a poetry environment problem
and the `poetry self add keyrings.google-artifactregistry-auth` is not
actually installing the library correctly. (We had this problem and we don't
fully understand the issue, but we suspect its because our `poetry` was
installed by brew and when using `poetry self ...` it's not updating the
environment in the right directory. `poetry self update` flat out aborts
saying it cannot do that when installed via brew.)

### To install this module outside this repo:

```
poetry source add --priority=supplemental public-python https://us-central1-python.pkg.dev/cds-artifacts/public-python/simple/
poetry add --source public-python depmap-compute
```

**NOTE** `depmap-compute` is already installed in both Depmap Portal and Breadbox by above commands. Simply make sure the version for `depmap-compute` mentioned in those projects are up-to-date
