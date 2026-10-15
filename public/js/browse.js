const words = ["Vince", "Bob", "James"];

const searchRequest = (searchTerm) => {
  const normalizedTerm = searchTerm.toLowerCase().replace(/\s+/g, "");

  return words.filter((word) =>
    word.toLowerCase().replace(/\s+/g, "").includes(normalizedTerm)
  );
};

console.log(searchRequest("Vi"));
