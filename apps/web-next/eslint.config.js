import rootConfig from "../../eslint.config.js";

export default [
  ...rootConfig,
  {
    rules: {
      // Next lint apontou arquivos com export misto; desabilitamos para evitar bloqueio
      "react-refresh/only-export-components": "off",
    },
  },
];
