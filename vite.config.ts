export default ({ command }: { command: "build" | "serve" }) => ({
  base: command === "build" ? "/bullet-hell-maker/" : "/",
  cacheDir: "C:/tmp/vite-school-fes-just-beat-it",
});
