# `mina-fungible-token`

Standard implementation of fungible tokens in Mina, as per
[RFC14: Fungible Token Standard on Mina](https://github.com/o1-labs/rfcs/blob/main/0014-fungible-token-standard.md).

This implementation is currently a beta. We do not expect the API to change anytime soon. We are
awaiting an audit of the code before removing the beta status.

## Install and run litenet with proofs enabled

`npm install -g zkapp-cli && zk lightnet start -p full -t real -l Debug`

## Running e2e test

```sh
npm i
npm run task examples/e2e.eg.ts
```

## License

`mina-fungible-token` is [Apache licensed](LICENSE).
