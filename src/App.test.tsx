import {describe, it, expect} from "vitest";
import {render, screen} from "@testing-library/react";
import {BrowserRouter} from "react-router-dom";
import App from "./App.js";

describe("App", () => {
  it("renders without crashing", () => {
    render(
      <BrowserRouter>
        <App>
          <div>Test content</div>
        </App>
      </BrowserRouter>
    );

    expect(screen.getByText("Test content")).toBeInTheDocument();
  });
});
