const path = require("path");
const nodeExternals = require("webpack-node-externals");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const CopyWebpackPlugin = require("copy-webpack-plugin");

module.exports = {
  entry: "./server/index.js",
  target: "node",
  externals: [nodeExternals()],
  output: {
    path: path.resolve("server-build"),
    filename: "index.js",
  },
  plugins: [
    new HtmlWebpackPlugin(),
    new CopyWebpackPlugin({ patterns: [{ from: "server/views", to: "views" }] }),
  ],
  module: {
    rules: [
      {
        test: /\.js$/,
        use: "babel-loader",
      },
      {
        test: /\.css$/i,
        use: ["css-loader"],
      },
    ],
  },
};
