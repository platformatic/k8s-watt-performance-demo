using Workerd = import "/workerd/workerd.capnp";

const config :Workerd.Config = (
  services = [
    (name = "main", worker = .mainWorker),
  ],
  sockets = [
    ( name = "http",
      address = "*:3008",
      http = (),
      service = "main"
    ),
  ],
);

const mainWorker :Workerd.Worker = (
  modules = [
    (name = "worker", esModule = embed "worker-bundle.js"),
  ],
  compatibilityDate = "2024-12-01",
);
