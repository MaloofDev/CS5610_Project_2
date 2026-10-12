# LicenseLens

## Authors

Kaleb Maloof and Vincent Putiri

## Class Link

[CS5610 Web Development, Northeastern University](https://northeastern.instructure.com/courses/261032)

## Project Objective

LicenseLens catches license conflicts in your dependencies before you ship. Paste a `package.json`, `requirements.txt`, or plain list, choose a closed-source or open-source goal, and get a color-coded audit with a reason for each dependency. It uses real data from the npm, PyPI, and Packagist registries, and signed-in users can add packages and save their audits.

## Data Sources

The 3,000 seeded packages were fetched on October 12, 2026 by `npm run seed:fetch`.

| Ecosystem | Packages | Which packages                                                                                                                          | Package details                                                                    |
| --------- | -------- | --------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| npm       | 1,000    | Most downloaded results from the [npm registry search API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md#get-v1search) | [npm registry API](https://github.com/npm/registry/blob/main/docs/REGISTRY-API.md) |
| PyPI      | 1,500    | [Top PyPI Packages](https://hugovk.dev/top-pypi-packages/) by Hugo van Kemenade                                                         | [PyPI JSON API](https://docs.pypi.org/api/json/)                                   |
| Packagist | 500      | [Packagist popular packages](https://packagist.org/explore/popular)                                                                     | [Packagist metadata API](https://packagist.org/apidoc#get-package-metadata-v2)     |

License IDs follow the [SPDX License List](https://spdx.org/licenses/).

## Screenshot

![LicenseLens login page](docs/screenshot.png)

## Instructions to Build

Requirements: Node.js 22+ and Docker Desktop.

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`, then set `SESSION_SECRET` to a long random string and `ADMIN_PASSWORD` to the password for the seeded `admin` account.

3. Start MongoDB and load the seed data:

   ```bash
   npm run db:up
   npm run seed
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).
