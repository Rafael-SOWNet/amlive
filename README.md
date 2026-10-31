# AngouriMath Live (temporary)

**https://rafael-sownet.github.io/amlive/**

[AngouriMath](https://github.com/asc-community/AngouriMath) running in the browser as WebAssembly,
with no server: seven demos (Waves, Representations, Shapes, Calculus, Logic, Regions, Motion).
Every answer on the page is computed by the library in a worker in your browser.

**[`probe/`](https://rafael-sownet.github.io/amlive/probe/)** has three tiny pages that measure
what loading the library costs: bytes over the network, time until the runtime is ready, and time to
the first `Simplify`. They reproduce
[AngouriMath#2296](https://github.com/asc-community/AngouriMath/issues/2296) and bear on
[AngouriMath#1692](https://github.com/asc-community/AngouriMath/issues/1692); each has a
*Run again cold* link, and a JSON block to paste into an issue.

This repository holds only the built pages. The demos use two features that are not in a release
yet, [dimensional analysis (#2292)](https://github.com/asc-community/AngouriMath/issues/2292) and
[shader source (#2293)](https://github.com/asc-community/AngouriMath/issues/2293), built from master
`aef5535` with branches `feat/dimensional-analysis` and `feat/shader-source` merged. The intended home
of the demos is the AngouriMath website; this page goes away when they are there.

AngouriMath and the .NET runtime are under the MIT license. MathJax is loaded from cdnjs.
