# Next.js with Watt

We built Watt to be the best place to run any Node.js service (including Next) in any container.

To see how Watt can help improve the performance of your service, use this repo 
to run your app using multiple workers with Watt.

> [!Tip]
> Try giving your pods some more CPUs to work with and see what that does.
> You can find some example pod sizes and benchmarks from previous runs we've done on EKS here.

This demo compares running Next.js in `watt`, `pm2`, and `node`.

## Usage

The _docker-compose.yml_ and _kube.yaml_ files are adjustable and passed into
our benchmarking scripts. Try changing the resources and `WORKERS` in these
files before running them.

Typically, `WORKERS` should match the number of CPU being used. In Kubernetes,
it can be pushed up to the limit. So, if the request is 2CPU with a limit of
3CPU then `WORKERS` can be set to `3`.

### Cloud benchmarking

The Platformatic team has created guides for using various cloud providers with
our benchmarking script. These will launch a demo into the cloud and then remove
all of the resources when completed or cancelled.

Benchmarking scripts available:

* [AWS EC2](../../aws-ec2/README.md)
* [AWS EKS](../../aws-eks/README.md)

This demo is called `next`.

### Manual setup - Kubernetes

If you have a Kubernetes cluster available for testing, the _kube.yaml_ file can
be applied.

```sh
kubectl apply -f kube.yaml
```

This will deploy `Service`s of a type of `NodePort` for access. All of the
deployed `Service`s can be found with:

```sh
kubectl get service \
  -o jsonpath='{.items[?(@.metadata.annotations.benchmark.platformatic.dev/expose=="true")].metadata.name}'
```

Once the demo is deployed, execute _autocannon.sh_ against the environment:

```sh
TARGET_URL=http://<ip-or-host> ./autocannon.sh
```

All deployment options use fixed port numbers so that _autocannon.sh_ can be
easily applied against any environment.

### Manual setup - Docker Compose

This demo can be run locally using `docker compose` but be aware that
`autocannon` will be in contention for resources with the demo.

```sh
docker compose up
```

Once the demo is deployed, execute _autocannon.sh_ against the environment:

```sh
TARGET_URL=http://<ip-or-host> ./autocannon.sh
```

All deployment options use fixed port numbers so that _autocannon.sh_ can be
easily applied against any environment.

## Performance results

The complete results of our tests runs are available in [PERFORMANCE.md](./PERFORMANCE.md).

This is a comparison in Kubernetes with each deployment running 2-3 CPUs and
each having a HPA with min 2 and max 10, averaging 50% CPU utilization.

Node runner:

```sh
Running 40s warmup @ http://10.0.1.210:30000
 100 -d 10 connections
Running 40s test @ http://10.0.1.210:30000
100 connections
┌─────────┬───────┬───────┬───────┬───────┬──────────┬─────────┬────────┐
│ Stat    │ 2.5%  │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev   │ Max    │
├─────────┼───────┼───────┼───────┼───────┼──────────┼─────────┼────────┤
│ Latency │ 24 ms │ 29 ms │ 57 ms │ 59 ms │ 29.62 ms │ 9.85 ms │ 826 ms │
└─────────┴───────┴───────┴───────┴───────┴──────────┴─────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬─────────┬────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg     │ Stdev  │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────┼─────────┤
│ Req/Sec   │ 1,621   │ 1,621   │ 3,479   │ 3,513   │ 3,321.2 │ 417.58 │ 1,621   │
├───────────┼─────────┼─────────┼─────────┼─────────┼─────────┼────────┼─────────┤
│ Bytes/Sec │ 21.3 MB │ 21.3 MB │ 45.8 MB │ 46.3 MB │ 43.7 MB │ 5.5 MB │ 21.3 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴─────────┴────────┴─────────┘
Req/Bytes counts sampled once per second.
# of samples: 40
133k requests in 40.03s, 1.75 GB read
```

watt-extra runner with 3 workers:

```sh
Running 40s warmup @ http://10.0.1.210:30042
 100 -d 10 connections
Running 40s test @ http://10.0.1.210:30042
100 connections
┌─────────┬──────┬───────┬───────┬───────┬──────────┬──────────┬────────┐
│ Stat    │ 2.5% │ 50%   │ 97.5% │ 99%   │ Avg      │ Stdev    │ Max    │
├─────────┼──────┼───────┼───────┼───────┼──────────┼──────────┼────────┤
│ Latency │ 7 ms │ 13 ms │ 81 ms │ 99 ms │ 19.54 ms │ 21.77 ms │ 689 ms │
└─────────┴──────┴───────┴───────┴───────┴──────────┴──────────┴────────┘
┌───────────┬─────────┬─────────┬─────────┬─────────┬──────────┬──────────┬─────────┐
│ Stat      │ 1%      │ 2.5%    │ 50%     │ 97.5%   │ Avg      │ Stdev    │ Min     │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Req/Sec   │ 2,025   │ 2,025   │ 5,903   │ 7,451   │ 5,298.25 │ 1,960.19 │ 2,025   │
├───────────┼─────────┼─────────┼─────────┼─────────┼──────────┼──────────┼─────────┤
│ Bytes/Sec │ 26.7 MB │ 26.7 MB │ 77.8 MB │ 98.2 MB │ 69.8 MB  │ 25.8 MB  │ 26.7 MB │
└───────────┴─────────┴─────────┴─────────┴─────────┴──────────┴──────────┴─────────┘
Req/Bytes counts sampled once per second.
# of samples: 40
212k requests in 40.03s, 2.79 GB read
123 errors (0 timeouts)
```
