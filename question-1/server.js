import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();
const app = express();
const port = process.env.PORT || 3000;

async function fetchProducts(company, category, top, minPrice, maxPrice, token) {
    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        };
        let data;

        if (!company) {
            const companies = ["AMZ", "FLP", "SNP", "MYN", "AZO"];
            const requests = companies.map(c =>
                axios.get(`http://20.244.56.144/test/companies/${c}/categories/${category}/products`, {
                    params: { top, minPrice, maxPrice },
                    headers
                })
            );
            const responses = await Promise.all(requests);
            data = responses.flatMap((resp, index) => resp.data.map((product, ind) => ({
                ...product,
                productId: `${category}_${product.productName.replace(/\s/g, '_')}_${index}_${ind}`,
                category: category
            })));
            data.sort((a, b) => a.rating - b.rating);
        } else {
            const response = await axios.get(`http://20.244.56.144/test/companies/${company}/categories/${category}/products`, {
                params: { top, minPrice, maxPrice },
                headers
            });
            data = response.data.map((product, ind) => ({
                ...product,
                productId: `${category}_${product.productName.replace(/\s/g, '_')}_${ind}`,
                category: category
            }));
        }

        fs.writeFileSync('products.json', JSON.stringify(data, null, 2));

        return data;
    } catch (error) {
        console.error(error);
        throw new Error('Failed to fetch products');
    }
}

app.get("/categories/:category/products/", async (req, res) => {
    const { category } = req.params;
    const { top = 10, page = 1, minPrice, maxPrice, rating, price, discount, company } = req.query;

    try {
        let token = null;
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith('Bearer ')) {
            token = authHeader.split('Bearer ')[1];
        } else {
            throw new Error('Authorization token not found or malformed');
        }

        const limit = Math.min(top, 10);
        const skip = (page - 1) * limit;

        let data = await fetchProducts(company, category, top, minPrice, maxPrice, token);

        if (rating) {
            data.sort((a, b) => rating === "asc" ? a.rating - b.rating : b.rating - a.rating);
        }
        if (price) {
            data.sort((a, b) => price === "asc" ? a.price - b.price : b.price - a.price);
        }
        if (discount) {
            data.sort((a, b) => discount === "asc" ? a.discount - b.discount : b.discount - a.discount);
        }

        const paginatedData = data.slice(skip, skip + limit);

        res.json({ status: 200, data: paginatedData, totalItems: data.length, totalPages: Math.ceil(data.length / limit), currentPage: page });
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ status: 500, error: error.message });
    }
});

app.get("/categories/:category/products/:productId", async (req, res) => {
    const { category, productId } = req.params;

    try {
        const rawData = fs.readFileSync('products.json', 'utf8');
        const data = JSON.parse(rawData);

        const product = data.find(p => p.productId === productId && p.category === category);

        if (product) {
            res.json({ status: 200, data: product });
        } else {
            res.status(404).json({ status: 404, error: 'Product not found' });
        }
    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ status: 500, error: error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});