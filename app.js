import puppeteer from 'puppeteer';
import Airtable from 'airtable';
import cron from 'node-cron';
console.log('hello')
const base = new Airtable({
  apiKey: 'keyhc1LUeY7WXZ4HJ',
}).base('appAwl2GocHFglKB1');

const scraper = async () => {
	const links = [];

	async function scrapeOne() {
		console.log('ScrapeOne function started executing');
		const baseUrl = 'https://www.schooljobs.com/careers/TacomaPublicSchools?&page=';
		let pageNum = 1;
		let pageUrl = baseUrl + pageNum; // Start with the first page
	
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
	
		const MAX_WAIT_TIME = 3000; // Maximum wait time in milliseconds
	
		while (true) {
			await page.goto(pageUrl);
	
			try {
				await page.waitForSelector('.item-details-link', { timeout: MAX_WAIT_TIME });
	
				const pageLinks = await page.$$eval('.search-results-container .search-results-listing-container .list-item .item-details-link', elements => elements.map(el => ({
					text: el.textContent.trim(),
					url: el.href
				})));
	
				if (pageLinks.length === 0) break;
	
				links.push(...new Set(pageLinks)); // Add links from current page to overall links array
	
				pageNum += 1;
				pageUrl = baseUrl + pageNum; // Update the URL to the new page
			} catch (error) {
				console.log(`Timed out waiting for selector on page ${pageUrl}`);
				break;
			}
		}
	
		await browser.close();
	
		console.log('ScrapeOne function finished executing');
	}

	async function scrapeTwo() {
		console.log('ScrapeTwo function started executing');
		const baseUrl = 'https://upsdjobs.myschooldata.net/JobOpenings.aspx';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();

		await page.goto(baseUrl);
		console.log(`Loaded page ${baseUrl}`);

		const MAX_WAIT_TIME = 3000; // Maximum wait time in milliseconds

		try {
			await page.waitForSelector('#dnn_ctr636_Applicant_JobOpenings_grdJobs_DXDataRow0', { timeout: MAX_WAIT_TIME });

			const pageLinks = await page.$$eval('.dxgvDataRow_Office2010Black', rows =>
				rows.reduce((acc, row) => {
					const titleEl = row.querySelector('.dxgv:nth-child(5)');
					const urlEl = row.querySelector('.dxgvCommandColumnItem_Office2010Black');

					if (titleEl && urlEl) {
						const text = titleEl.textContent.trim();
						const url = 'https://upsdjobs.myschooldata.net/JobOpenings.aspx';
						acc.push({ text, url });
					}

					return acc;
				}, [])
			);

			links.push(...pageLinks); // Add links from current page to overall links array
		} catch (error) {
			console.log(`Timed out waiting for selector on page ${baseUrl}`);
		}

		await browser.close();
	}

	async function scrapeThree() {
		console.log('ScrapeThree function started executing')
		const url = 'https://www.applitrack.com/Puyallupk12/onlineapp/default.aspx?all=1&AppliTrackPostingSearch=title%3Ateacher%20&AppliTrackZipRadius=5&AppliTrackSort=type&AppliTrackLayoutMode=detail';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
	
		await page.goto(url);
		console.log(`Loaded page ${url}`);
	
		const MAX_WAIT_TIME = 3000; // Maximum wait time in milliseconds
		let results = [];
	
		try {
			await page.waitForSelector('.postingsList .title', { timeout: MAX_WAIT_TIME });
	
			results = await page.$$eval('.postingsList .title', titles =>
				titles.map(title => {
					const textEl = title.querySelector('#wrapword');
					if (textEl) {
						const text = textEl.textContent.trim();
						return { text, url: 'https://www.applitrack.com/Puyallupk12/onlineapp/default.aspx?all=1&AppliTrackPostingSearch=title%3Ateacher%20&AppliTrackZipRadius=5&AppliTrackSort=type&AppliTrackLayoutMode=detail' };
					}
				}).filter(Boolean)
			);
	
			links.push(...results); // Add links from current page to overall links array
		} catch (error) {
			console.log(error)
			console.log(`Timed out waiting for selector on page ${url}`);
		}
	
		await browser.close();
		return results;
	}

	async function scrapeFour() {
		console.log('ScrapeFour function started executing')
		const url = 'https://kent.tedk12.com/hire/index.aspx';
		const browser = await puppeteer.launch();
		const page = await browser.newPage();
	
		await page.goto(url);
		console.log(`Loaded page ${url}`);
	
		const MAX_WAIT_TIME = 3000; // Maximum wait time in milliseconds
		let results = [];
	
		try {
			let hasNextPage = true;
	
			while (hasNextPage) {
				await page.waitForSelector('#JobList', { timeout: MAX_WAIT_TIME });
	
				const pageResults = await page.$$eval('#JobList tr', rows =>
					rows.map(row => {
						const textEl = row.querySelector('td:first-child a');
						const urlEl = row.querySelector('td:last-child a');
						if (textEl && urlEl) {
							const text = textEl.textContent.trim();
							const url = 'https://kent.tedk12.com/hire/' + urlEl.getAttribute('href');
							return { text, url };
						}
					}).filter(Boolean)
				);
	
				results.push(...pageResults);

				const WAIT_TIME_AFTER_NEXT_PAGE_CLICK = 2000; // 2 seconds
	
				const nextButton = await page.$('.PagingArrow[title="Next Page"]');
				if (!nextButton) {
					hasNextPage = false;
				} else {
						console.log('true')
						await nextButton.click();
						await page.waitForTimeout(WAIT_TIME_AFTER_NEXT_PAGE_CLICK); // Wait for page to load
						// await page.waitForNavigation({ waitUntil: 'networkidle0' });
				}
			}
	
		} catch (error) {
			console.log(`Timed out waiting for selector on page ${url}`);
		}
	
		await browser.close();
		links.push(...results); // Add links from current page to overall links array
	}

	await Promise.all([scrapeOne(), scrapeTwo(), scrapeThree(), scrapeFour()]);

  const filteredLinks = links.filter(link => link.text.toLowerCase().includes('teacher'));

	const uniqueLinks = filteredLinks.reduce((acc, link) => {
		const existingLink = acc.find(l => l.text === link.text);
		if (!existingLink) {
			acc.push(link);
		}
		return acc;
	}, []);

 // Create a new record in Airtable for each unique link
 const existingLinks = new Set(); // Store existing links in a Set for faster lookup

 await base('Links').select({
	 fields: ['Text']
 }).eachPage((records, fetchNextPage) => {
	 records.forEach(record => {
		 existingLinks.add(record.get('Text').toLowerCase());
	 });
	 fetchNextPage();
 });

 const newLinks = uniqueLinks.filter(link => !existingLinks.has(link.text.toLowerCase()));

 newLinks.forEach(link => {
	 base('Links').create({
		 'Text': link.text,
		 'URL': link.url,
		 'Added': new Date().toLocaleDateString('en-US'),
	 }, function(err, record) {
		 if (err) {
			 console.error(err);
			 return;
		 }
		 console.log(`Created record with ID ${record.id}`);
	 });
 });

	return {
		links: uniqueLinks
	};
};

async function startScraper() {
  console.log('Running the scraper');
  await scraper();
}

startScraper(); // Call the scraper function on initial build

cron.schedule('0 */12 * * *', async () => {
  console.log('Running the scraper every 12 hours');
  await scraper();
});