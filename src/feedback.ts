import { renderHTML } from "./htmltools";
import { raw } from "hono/html";

export const feedbackHandler = async (c: any) => {
  const feeedbackForm = `
    <h1 style="text-align:center;">Feedback</h1>
    <p style="text-align:center;">Please leave your feedback below. We appreciate your input!</p>
    <script data-letterbirduser="minifeed" src="https://letterbird.co/embed/v1.js"></script>
    `;
  return c.html(
    renderHTML(
      "Feedback | minifeed",
      raw(feeedbackForm),
      c.get("USERNAME"),
      "feedback",
    ),
  );
};
