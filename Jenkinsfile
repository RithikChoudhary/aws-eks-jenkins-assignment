pipeline {
    agent any

    options {
        timestamps()
        disableConcurrentBuilds()
        skipDefaultCheckout(true)
        timeout(time: 30, unit: 'MINUTES')
        buildDiscarder(logRotator(numToKeepStr: '10'))
    }

    environment {
        AWS_REGION = 'eu-north-1'
        AWS_ACCOUNT_ID = '670518341325'
        EKS_CLUSTER = 'api-testing'
        ECR_REPOSITORY = 'api-testing'
        K8S_NAMESPACE = 'devops-assignment'

        IMAGE_URI = "${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com/${ECR_REPOSITORY}"
        KUBECONFIG = "${WORKSPACE}/kubeconfig"
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Build') {
            steps {
                sh '''
                    set -eu

                    docker run --rm \
                      --user "$(id -u):$(id -g)" \
                      -e HOME=/tmp \
                      -v "$WORKSPACE:/app" \
                      -w /app \
                      node:22-alpine \
                      sh -c "npm ci && npm run build"
                '''
            }
        }

        stage('Unit Test') {
            steps {
                sh '''
                    set -eu

                    docker run --rm \
                      --user "$(id -u):$(id -g)" \
                      -e HOME=/tmp \
                      -v "$WORKSPACE:/app" \
                      -w /app \
                      node:22-alpine \
                      npm test
                '''
            }
        }

        stage('Docker Build') {
            steps {
                sh '''
                    set -eu

                    docker build \
                      --tag "${IMAGE_URI}:${BUILD_NUMBER}" \
                      .
                '''
            }
        }

        stage('Push to ECR') {
            steps {
                sh '''
                    set -eu

                    ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

                    aws ecr get-login-password \
                      --region "$AWS_REGION" |
                    docker login \
                      --username AWS \
                      --password-stdin "$ECR_REGISTRY"

                    docker push "${IMAGE_URI}:${BUILD_NUMBER}"
                '''
            }
        }

        stage('Deploy to Kubernetes') {
            steps {
                withCredentials([
                    string(
                        credentialsId: 'sample-api-demo-secret',
                        variable: 'DEMO_SECRET'
                    )
                ]) {
                    sh '''
                        set -eu

                        aws eks update-kubeconfig \
                          --name "$EKS_CLUSTER" \
                          --region "$AWS_REGION" \
                          --kubeconfig "$KUBECONFIG"

                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f k8s/namespace.yaml

                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f k8s/configmap.yaml

                        kubectl create secret generic sample-api-secret \
                          --namespace "$K8S_NAMESPACE" \
                          --from-literal=DEMO_SECRET="$DEMO_SECRET" \
                          --dry-run=client \
                          -o yaml |
                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f -

                        sed "s|IMAGE_URI_PLACEHOLDER|${IMAGE_URI}:${BUILD_NUMBER}|g" \
                          k8s/deployment.yaml |
                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f -

                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f k8s/service.yaml

                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f k8s/hpa.yaml

                        kubectl --kubeconfig "$KUBECONFIG" \
                          apply -f k8s/ingress.yaml

                        kubectl --kubeconfig "$KUBECONFIG" \
                          rollout status deployment/sample-api \
                          --namespace "$K8S_NAMESPACE" \
                          --timeout=300s
                    '''
                }
            }
        }

        stage('Smoke Test') {
            steps {
                sh '''
                    set -eu

                    for attempt in $(seq 1 20); do
                        ALB_DNS="$(kubectl \
                          --kubeconfig "$KUBECONFIG" \
                          get ingress sample-api \
                          --namespace "$K8S_NAMESPACE" \
                          -o jsonpath='{.status.loadBalancer.ingress[0].hostname}')"

                        if [ -n "$ALB_DNS" ]; then
                            echo "Testing http://${ALB_DNS}/health"

                            if curl \
                              --fail \
                              --silent \
                              --show-error \
                              "http://${ALB_DNS}/health"; then

                                echo
                                echo "Smoke test passed"
                                exit 0
                            fi
                        fi

                        echo "Waiting for healthy ALB target: ${attempt}/20"
                        sleep 15
                    done

                    echo "Smoke test failed"
                    exit 1
                '''
            }
        }

        stage('Deployment Summary') {
            steps {
                sh '''
                    set -eu

                    kubectl --kubeconfig "$KUBECONFIG" \
                      get deployment,pods,service,ingress,hpa \
                      --namespace "$K8S_NAMESPACE"

                    echo
                    echo "Deployed image:"

                    kubectl --kubeconfig "$KUBECONFIG" \
                      get deployment sample-api \
                      --namespace "$K8S_NAMESPACE" \
                      -o jsonpath='{.spec.template.spec.containers[0].image}{"\\n"}'
                '''
            }
        }
    }

    post {
        always {
            sh '''
                rm -f "$KUBECONFIG"

                ECR_REGISTRY="${AWS_ACCOUNT_ID}.dkr.ecr.${AWS_REGION}.amazonaws.com"

                docker logout "$ECR_REGISTRY" || true

                docker image rm \
                  "${IMAGE_URI}:${BUILD_NUMBER}" || true
            '''
        }

        success {
            echo 'CI/CD pipeline completed successfully.'
        }

        failure {
            echo 'Pipeline failed. Check the failed stage in Console Output.'
        }
    }
}
