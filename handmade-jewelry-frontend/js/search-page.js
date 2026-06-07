let currentKeyword = '';
let currentCategory = 'all';
let searchResults = [];

function initSearch() {
    const urlParams = new URLSearchParams(window.location.search);
    const keyword = urlParams.get('q');
    
    if (keyword) {
        document.getElementById('searchInput').value = keyword;
        performSearch(keyword);
    } else {
        showPopularProducts();
    }

    loadSearchHistory();
    updateCartBadge();

    document.getElementById('searchInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
}

function performSearch(keyword) {
    keyword = keyword || document.getElementById('searchInput').value.trim();
    
    if (!keyword) {
        showNotification('请输入搜索关键词');
        return;
    }

    currentKeyword = keyword;
    saveSearchHistory(keyword);

    searchResults = mockProducts.filter(product => {
        const matchKeyword = product.name.toLowerCase().includes(keyword.toLowerCase()) ||
                           product.description.toLowerCase().includes(keyword.toLowerCase());
        
        const matchCategory = currentCategory === 'all' || 
                             product.category === currentCategory;

        return matchKeyword && matchCategory;
    });

    displayResults();
}

function filterByCategory(category) {
    currentCategory = category;
    
    document.querySelectorAll('.filter-chip').forEach(chip => {
        chip.classList.remove('active');
    });
    event.target.classList.add('active');

    if (currentKeyword) {
        performSearch(currentKeyword);
    }
}

function displayResults() {
    const container = document.getElementById('searchResults');
    const emptyEl = document.getElementById('emptyResults');
    const countEl = document.getElementById('resultsCount');

    countEl.innerHTML = `找到 <strong>${searchResults.length}</strong> 个商品`;

    if (searchResults.length === 0) {
        container.innerHTML = '';
        emptyEl.style.display = 'block';
    } else {
        emptyEl.style.display = 'none';
        container.innerHTML = searchResults.map(product => createProductCard(product)).join('');
    }
}

function sortResults() {
    const sortBy = document.getElementById('sortSelect').value;

    switch(sortBy) {
        case 'price-asc':
            searchResults.sort((a, b) => a.price - b.price);
            break;
        case 'price-desc':
            searchResults.sort((a, b) => b.price - a.price);
            break;
        case 'rating':
            searchResults.sort((a, b) => b.rating - a.rating);
            break;
        case 'newest':
            searchResults.sort((a, b) => b.id - a.id);
            break;
        default:
            break;
    }

    displayResults();
}

function showPopularProducts() {
    searchResults = mockProducts.slice(0, 8);
    displayResults();
    document.getElementById('resultsCount').innerHTML = `热门推荐 <strong>${searchResults.length}</strong> 个商品`;
}

function saveSearchHistory(keyword) {
    let history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    history = history.filter(k => k !== keyword);
    history.unshift(keyword);
    history = history.slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(history));
}

function loadSearchHistory() {
    const history = JSON.parse(localStorage.getItem('searchHistory') || '[]');
    
    if (history.length > 0) {
        const container = document.getElementById('searchHistory');
        const tagsContainer = document.getElementById('historyTags');
        
        container.style.display = 'block';
        tagsContainer.innerHTML = history.map(keyword => 
            `<span class="history-tag" onclick="searchFromHistory('${keyword}')">${keyword}</span>`
        ).join('');
    }
}

function searchFromHistory(keyword) {
    document.getElementById('searchInput').value = keyword;
    performSearch(keyword);
}

document.addEventListener('DOMContentLoaded', initSearch);

document.getElementById('headerSearchInput')?.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const keyword = this.value.trim();
        window.location.href = `search.html?q=${encodeURIComponent(keyword)}`;
    }
});
