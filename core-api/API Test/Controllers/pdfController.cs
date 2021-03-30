using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using CSCompareLib;
using Syncfusion.Pdf;
using Syncfusion.Pdf.Parsing;
using Syncfusion.Pdf.Graphics;
using Syncfusion.Pdf.Grid;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.AspNetCore.Cors;
using static API_Test.Program;

namespace API_Test.Controllers
{
    [Produces("application/json")]
    [Route("api/pdf")]
    //[EnableCors("AllowAll")]
    public class pdfController : Controller
    {
        // GET: api/pdf
       /* [HttpGet]
        public IEnumerable<string> Get()
        {
            return new string[] { "value1", "value2" };
        }*/

        // GET: api/pdf/5
        [HttpGet/*("{id}", Name = "Get")*/]
        [EnableCors("AllowAll")]
        public string Get([FromQuery]string question)
        {

            List<PdfFormatWrapper> results = new List<PdfFormatWrapper>();
            string[] filePaths = Directory.GetFiles(@"C:\Users\HP\\source\repos\API Test\API Test\root\");
            
            foreach (var path in filePaths)
            {
                string fileName = Path.GetFileName(path);
                FileStream docStream = new FileStream(path, FileMode.Open, FileAccess.Read);
                PdfLoadedDocument loadedDocument = new PdfLoadedDocument(docStream);
                PdfLoadedPageCollection loadedPages = loadedDocument.Pages;
                string extractedText = string.Empty;
                foreach (PdfLoadedPage loadedPage in loadedPages)

                {

                    extractedText += loadedPage.ExtractText();//.Trim();

                }
                var newString = string.Join(" ", Regex.Split(extractedText, @"(?:\r\n|\n|\r)"));
                var result = CSCompare.Compute(question, newString);
                results.Add(
                      new PdfFormatWrapper
                      {
                          nameOfFile = fileName ,
                          value = result
                      }


                    );
                loadedDocument.Close(true);
                

            }
            // var sendResult ="Text "+" ' "+question+" ' "+" se nalazi u fajlu: "+ results.OrderByDescending(x => x.value).FirstOrDefault().nameOfFile;
            var sendResult = results.OrderByDescending(x => x.value).FirstOrDefault().nameOfFile;
            return sendResult;
          

            
            
        }
        
        // POST: api/pdf
        [HttpPost]
        public void Post([FromBody]string value)
        {
        }
        
        // PUT: api/pdf/5
        [HttpPut("{id}")]
        public void Put(int id, [FromBody]string value)
        {
        }
        
        // DELETE: api/ApiWithActions/5
        [HttpDelete("{id}")]
        public void Delete(int id)
        {
        }
    }
}
