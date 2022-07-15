import { mapboxSearch } from "./request";
import { addSuggestionsToInput, createDropdown, elementFocus } from "./suggestions";

function addMapboxListener(target, custom_options) {
  let dropdown = createDropdown(target);
  let timeout = null;

  target.addEventListener("input", (e) => {
    let input = e.currentTarget.value;
    if (input.length === 0) {
      dropdown.parentElement.hidden = true;
    }
    if (input.length < 3) return;

    clearTimeout(timeout);
    timeout = setTimeout(async () => {
      const results = await mapboxSearch(input, custom_options);
      addSuggestionsToInput(target, dropdown, results);
      elementFocus(dropdown.children[0]);
    }, 300);
  });

  document.addEventListener("click", () => {
    dropdown.parentElement.hidden = true;
  });
}

export { addMapboxListener };
