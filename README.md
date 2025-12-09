# `ft-server-node`
Implementation of the [Frakatime specification](https://github.com/frakatime/spec) in NodeJS

## Usage
```sh
git clone https://github.com/frakatime/ft-server-node
cd ft-server-node
pnpm i
pnpm build
# edit .env
pnpm start
```

## `.env`
```
FT_USERNAME=user
FT_PASSWORD=passwd
FT_DB=db.sqlite
FT_VERSION=V2 # (or V1)
```
