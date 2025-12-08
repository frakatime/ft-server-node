# `ft-server-node`
Implementation of the [Frakatime specification](https://github.com/frakatime/spec) in NodeJS
>[!WARNING]
> Currently, `ft-server-node` only implements `v1` of the spec, `v2` will be added ASAP.


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
FT_DB=db.json
```
