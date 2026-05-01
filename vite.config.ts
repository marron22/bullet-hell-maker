export default ({ command }: { command: "build" | "serve" }) => ({
  base: command === "build" ? "/bullet-hell-maker/" : "/",
});
