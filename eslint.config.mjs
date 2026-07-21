import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * ⚠️ THE RTL RULE BELOW IS LOAD-BEARING.
 *
 * This app ships in English (LTR) and Farsi (RTL). Physical-direction
 * utilities (`pl-`, `mr-`, `left-`, `text-left`) do not mirror, so a single
 * `ml-2` produces a layout that is subtly wrong in Farsi — and nobody notices,
 * because the people writing the code read English. By the time someone does,
 * there are hundreds of them.
 *
 * Logical properties (`ps-`, `pe-`, `ms-`, `me-`, `start-`, `end-`,
 * `text-start`, `text-end`) mirror automatically. This rule fails the build on
 * the physical ones, which is the only way the invariant survives six more
 * phases of feature work.
 *
 * Genuinely physical things — a chevron pointing the way it will move — use
 * `rtl:rotate-180` instead.
 */
const RTL_BANNED =
  String.raw`(^|\s|["'` + "`" + String.raw`:])(-?(?:p|m)(?:l|r)-\d|(?:left|right)-\d|text-(?:left|right)\b|border-(?:l|r)-|rounded-(?:tl|tr|bl|br|l|r)-|float-(?:left|right)\b)`;

const RTL_MESSAGE =
  "RTL: use logical utilities (ps-/pe-/ms-/me-/start-/end-/text-start/text-end, border-s/border-e, rounded-s/rounded-e) — physical ones don't mirror in Farsi. For a genuinely physical icon, use rtl:rotate-180.";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      /**
       * Catches `useEffect(() => setState(prop), [prop])`, which commits the
       * STALE value for one frame and makes the UI visibly bounce after every
       * save. Adjust state DURING RENDER instead. ERROR, not warning — this
       * was a real and hard-to-diagnose class of bug on the reference project.
       */
      "react-hooks/set-state-in-effect": "error",

      "no-restricted-syntax": [
        "error",
        {
          selector: `Literal[value=/${RTL_BANNED}/]`,
          message: RTL_MESSAGE,
        },
        {
          selector: `TemplateElement[value.raw=/${RTL_BANNED}/]`,
          message: RTL_MESSAGE,
        },
      ],
    },
  },
  {
    // Node utilities that never render anything.
    files: ["scripts/**", "*.config.*"],
    rules: { "no-restricted-syntax": "off" },
  },
  globalIgnores([".next/**", "out/**", "build/**", "next-env.d.ts"]),
]);

export default eslintConfig;
