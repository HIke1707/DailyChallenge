namespace DynamicConfigProject
{
    public class OpenAIService
    {
        public void Configure(IConfiguration configuration)
        {
            var model = "gpt-" + configuration["OpenAI:Mode"];
        }
    }
}
